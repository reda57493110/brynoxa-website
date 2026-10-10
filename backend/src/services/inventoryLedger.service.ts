import mongoose, { type ClientSession, Types } from 'mongoose';
import { Product } from '../models/Product';
import { InventoryUnit, StockMovement, type Bucket, type MovementType, type UnitStatus } from '../models/Inventory';
import { ApiError } from '../utils/ApiError';
import { roundMoney } from '../utils/deposit';

/**
 * The inventory ledger. All stock changes go through `moveStock`, which — inside one database
 * transaction — checks the source bucket has enough units, moves them, keeps serial-tracked
 * units in sync, maintains the weighted-average cost, and writes a StockMovement. A movement with
 * an idempotencyKey can only ever be applied once, so retried or duplicated events are no-ops.
 */

export const BUCKET_LABEL: Record<string, string> = {
  available: 'available for sale',
  reserved: 'reserved',
  awaitingInspection: 'awaiting inspection',
  returned: 'returned (awaiting assessment)',
  defective: 'defective',
  underRepair: 'under repair',
  writtenOff: 'written off',
  external: 'outside the store',
};

const PHYSICAL: Bucket[] = ['available', 'reserved', 'awaitingInspection', 'returned', 'defective', 'underRepair'];

export function bucketPath(bucket: Bucket): string | null {
  if (bucket === 'external') return null;
  if (bucket === 'available') return 'stock';
  if (bucket.startsWith('custom:')) {
    const id = bucket.slice(7);
    if (!/^[a-z0-9-]{1,24}$/.test(id)) throw new ApiError(400, 'Unknown inventory status');
    return `inventory.custom.${id}`;
  }
  return `inventory.${bucket}`;
}

type ProductInv = {
  _id: Types.ObjectId;
  name: string;
  sku: string;
  stock: number;
  costPrice?: number;
  serialTracking?: boolean;
  inventory?: {
    reserved?: number;
    awaitingInspection?: number;
    returned?: number;
    defective?: number;
    underRepair?: number;
    writtenOff?: number;
    custom?: Map<string, number> | Record<string, number>;
    uncosted?: number;
  };
};

export function bucketCount(p: ProductInv, bucket: Bucket): number {
  if (bucket === 'external') return 0;
  if (bucket === 'available') return p.stock || 0;
  const inv = p.inventory || {};
  if (bucket.startsWith('custom:')) {
    const custom = inv.custom instanceof Map ? Object.fromEntries(inv.custom) : inv.custom || {};
    return custom[bucket.slice(7)] || 0;
  }
  return (inv as Record<string, number>)[bucket] || 0;
}

/** Units physically in the store (sellable + every non-sellable holding status, not written off). */
export function physicalUnits(p: ProductInv): number {
  const custom = p.inventory?.custom instanceof Map ? Object.fromEntries(p.inventory.custom) : p.inventory?.custom || {};
  return PHYSICAL.reduce((sum, b) => sum + bucketCount(p, b), 0) + Object.values(custom).reduce((a, b) => a + (b || 0), 0);
}

/** Runs `fn` in a transaction (Atlas replica set); falls back to no transaction on standalone servers. */
export async function withTransaction<T>(fn: (session: ClientSession | undefined) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } catch (error) {
    const msg = String((error as Error)?.message || '');
    if (/Transaction numbers are only allowed|replica set|does not support transactions/i.test(msg)) {
      return fn(undefined);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

/** Creates the inventory buckets for products that predate the ledger (existing stock is kept as-is). */
async function ensureInventory(productId: Types.ObjectId | string, session?: ClientSession) {
  const p = await Product.findById(productId).select('+inventory +costPrice stock').session(session ?? null);
  if (!p) throw new ApiError(404, 'Product not found');
  if (!p.inventory) {
    await Product.updateOne(
      { _id: p._id, inventory: { $exists: false } },
      {
        $set: {
          inventory: {
            reserved: 0, awaitingInspection: 0, returned: 0, defective: 0, underRepair: 0, writtenOff: 0,
            custom: {},
            uncosted: typeof p.costPrice === 'number' ? 0 : p.stock || 0,
          },
        },
      },
      { session }
    );
  }
}

export interface MoveInput {
  product: Types.ObjectId | string;
  qty: number;
  from: Bucket;
  to: Bucket;
  type: MovementType;
  reason: string;
  serials?: string[];
  /** Cost per unit entering the store (receipts, returns, repaired units). */
  unitCost?: number;
  by?: Types.ObjectId | string;
  order?: Types.ObjectId | string;
  orderNumber?: string;
  receipt?: Types.ObjectId | string;
  customerReturn?: Types.ObjectId | string;
  repair?: Types.ObjectId | string;
  transferId?: string;
  idempotencyKey?: string;
  /** For units entering the store with serials: their location / warranty. */
  unitDetails?: { location?: string; warranty?: string };
}

const unitStatusFor = (bucket: Bucket): UnitStatus => (bucket === 'external' ? 'sold' : (bucket as UnitStatus));

/** Move `qty` units of one product between buckets. Must be called inside withTransaction. */
export async function moveStock(input: MoveInput, session?: ClientSession) {
  const qty = Math.floor(input.qty);
  if (!(qty > 0)) throw new ApiError(400, 'Quantity must be at least 1');
  if (input.from === input.to) throw new ApiError(400, 'Choose a different status');
  if (!input.reason?.trim()) throw new ApiError(400, 'A reason is required for every stock change');

  if (input.idempotencyKey) {
    const seen = await StockMovement.exists({ idempotencyKey: input.idempotencyKey }).session(session ?? null);
    if (seen) return { duplicate: true as const };
  }

  await ensureInventory(input.product, session);
  const before = await Product.findById(input.product)
    .select('+inventory +costPrice name sku stock serialTracking')
    .session(session ?? null)
    .lean<ProductInv>();
  if (!before) throw new ApiError(404, 'Product not found');

  const fromPath = bucketPath(input.from);
  const toPath = bucketPath(input.to);
  const available = bucketCount(before, input.from);
  if (fromPath && available < qty) {
    throw new ApiError(409, `Only ${available} unit${available === 1 ? '' : 's'} of ${before.name} ${available === 1 ? 'is' : 'are'} ${BUCKET_LABEL[input.from] || input.from}`);
  }

  const inc: Record<string, number> = {};
  const set: Record<string, unknown> = {};
  if (fromPath) inc[fromPath] = -qty;
  if (toPath) inc[toPath] = qty;

  // Weighted-average cost: units entering the store blend into the product's cost
  const entering = input.from === 'external' || input.from === 'writtenOff';
  const leaving = input.to === 'external' || input.to === 'writtenOff';
  const uncosted = before.inventory?.uncosted || 0;
  if (entering && !leaving) {
    if (typeof input.unitCost === 'number' && input.unitCost >= 0) {
      const costedBefore = Math.max(0, physicalUnits(before) - uncosted);
      const avg = typeof before.costPrice === 'number' && costedBefore > 0
        ? (before.costPrice * costedBefore + input.unitCost * qty) / (costedBefore + qty)
        : input.unitCost;
      set.costPrice = roundMoney(avg);
    } else {
      inc['inventory.uncosted'] = qty;
    }
  }
  if (leaving && !entering && uncosted > 0) {
    // Oldest (uncosted) units are assumed to leave first
    inc['inventory.uncosted'] = -Math.min(uncosted, qty);
  }

  const filter: Record<string, unknown> = { _id: before._id };
  if (fromPath) filter[fromPath] = { $gte: qty };
  const after = await Product.findOneAndUpdate(filter, { $inc: inc, ...(Object.keys(set).length ? { $set: set } : {}) }, {
    new: true,
    session,
    projection: '+inventory name sku stock serialTracking',
  }).lean<ProductInv>();
  if (!after) throw new ApiError(409, `Stock for ${before.name} changed — please try again`);

  // Serial-tracked units follow the same move
  const serials = [...new Set((input.serials || []).map((s) => s.trim()).filter(Boolean))];
  if (serials.length) {
    if (serials.length !== qty) throw new ApiError(400, `Give exactly ${qty} serial number${qty === 1 ? '' : 's'}`);
    if (input.from === 'external') {
      await InventoryUnit.create(
        serials.map((serial) => ({
          product: before._id,
          serial,
          status: unitStatusFor(input.to),
          unitCost: input.unitCost,
          receipt: input.receipt,
          location: input.unitDetails?.location,
          warranty: input.unitDetails?.warranty,
        })),
        { session, ordered: true }
      ).catch((e: { code?: number }) => {
        if (e?.code === 11000) throw new ApiError(409, 'One of these serial numbers is already registered');
        throw e;
      });
    } else {
      const res = await InventoryUnit.updateMany(
        { product: before._id, serial: { $in: serials }, status: unitStatusFor(input.from) },
        { $set: { status: unitStatusFor(input.to), ...(input.order ? { order: input.order } : {}) } },
        { session }
      );
      if (res.modifiedCount !== serials.length) {
        throw new ApiError(409, `Some serial numbers are not ${BUCKET_LABEL[input.from] || input.from} for ${before.name}`);
      }
    }
  }

  const [movement] = await StockMovement.create(
    [
      {
        product: before._id,
        sku: before.sku,
        type: input.type,
        qty,
        from: input.from,
        to: input.to,
        fromAfter: fromPath ? bucketCount(after, input.from) : undefined,
        toAfter: toPath ? bucketCount(after, input.to) : undefined,
        serials,
        unitCost: input.unitCost ?? (typeof before.costPrice === 'number' ? before.costPrice : undefined),
        reason: input.reason.trim(),
        order: input.order,
        orderNumber: input.orderNumber,
        receipt: input.receipt,
        customerReturn: input.customerReturn,
        repair: input.repair,
        transferId: input.transferId,
        by: input.by,
        idempotencyKey: input.idempotencyKey,
      },
    ],
    { session }
  ).catch((e: { code?: number }) => {
    if (e?.code === 11000) throw new ApiError(409, 'This stock change was already recorded');
    throw e;
  });

  return { duplicate: false as const, movement, product: after };
}

/**
 * Moves units out of one listing into another (e.g. a repaired laptop into the "Refurbished"
 * listing). Two linked ledger entries; the destination's cost includes any repair cost.
 */
export async function transferBetweenListings(
  input: Omit<MoveInput, 'to' | 'product'> & { from: Bucket; fromProduct: string | Types.ObjectId; toProduct: string | Types.ObjectId; extraCostPerUnit?: number },
  session?: ClientSession
) {
  if (String(input.fromProduct) === String(input.toProduct)) throw new ApiError(400, 'Choose a different listing');
  const source = await Product.findById(input.fromProduct).select('+costPrice').session(session ?? null).lean<ProductInv>();
  if (!source) throw new ApiError(404, 'Product not found');
  const transferId = new Types.ObjectId().toString();
  const baseCost = typeof source.costPrice === 'number' ? source.costPrice : undefined;
  const unitCost = baseCost === undefined ? undefined : roundMoney(baseCost + (input.extraCostPerUnit || 0));

  const out = await moveStock(
    { ...input, product: input.fromProduct, to: 'external', unitCost: baseCost, transferId, idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:out` : undefined },
    session
  );
  if (out.duplicate) return out;
  // Serial-tracked units are re-pointed to the destination listing
  if (input.serials?.length) {
    await InventoryUnit.updateMany(
      { product: input.fromProduct, serial: { $in: input.serials }, status: 'sold' },
      { $set: { product: input.toProduct, status: 'available' } },
      { session }
    );
  }
  return moveStock(
    {
      ...input,
      product: input.toProduct,
      from: 'external',
      to: 'available',
      serials: undefined,
      unitCost,
      transferId,
      idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:in` : undefined,
    },
    session
  );
}
