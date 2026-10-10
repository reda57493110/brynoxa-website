import { Types } from 'mongoose';
import { Order } from '../models/Order';
import { Product, type ProductCondition } from '../models/Product';
import { getSettings } from '../models/Settings';
import {
  CustomerReturn,
  InventoryUnit,
  RepairRecord,
  SupplierReceipt,
  type Bucket,
  type RepairStatus,
  type ReturnOutcome,
} from '../models/Inventory';
import { ApiError } from '../utils/ApiError';
import { roundMoney } from '../utils/deposit';
import { slugify, uniqueSlug } from '../utils/slugify';
import { bucketCount, moveStock, transferBetweenListings, withTransaction } from './inventoryLedger.service';

type Actor = { id: string; canApprove: boolean };

function requireApproval(actor: Actor, what: string) {
  if (!actor.canApprove) throw new ApiError(403, `${what} needs inventory approval rights`);
}

async function loadProduct(id: string | Types.ObjectId) {
  const p = await Product.findById(id).select('name sku condition serialTracking baseProduct +costPrice');
  if (!p) throw new ApiError(404, 'Product not found');
  return p;
}

async function assertCustomStatus(bucket: Bucket) {
  if (!bucket.startsWith('custom:')) return;
  const id = bucket.slice(7);
  const ok = (await getSettings()).inventoryStatuses?.some((s) => s.id === id);
  if (!ok) throw new ApiError(400, 'Unknown inventory status');
}

/* ------------------------------------------------------------------ */
/* Supplier deliveries                                                  */
/* ------------------------------------------------------------------ */

type UnitResult = 'available' | 'defective' | 'underRepair' | 'awaitingInspection';

export interface ReceiptInput {
  supplier: string;
  reference?: string;
  receivedAt?: Date;
  location?: string;
  notes?: string;
  evidenceUrls?: string[];
  lines: {
    productId: string;
    qty: number;
    unitCost?: number;
    serials?: string[];
    warranty?: string;
    /** Bulk inspection counts; whatever is not classified stays "awaiting inspection". */
    result?: { available?: number; defective?: number; underRepair?: number };
    /** Per-serial inspection (serial-tracked products). */
    unitResults?: { serial: string; result: UnitResult; fault?: string }[];
    faultNotes?: string;
  }[];
}

/**
 * Registers a delivery. Units enter the store in the bucket matching their inspection result;
 * physical totals always equal the quantity received (e.g. 50 = 38 available + 12 to repair).
 */
export async function receiveDelivery(input: ReceiptInput, actor: Actor) {
  const settings = await getSettings();
  if (!input.lines.length) throw new ApiError(400, 'Add at least one product');

  return withTransaction(async (session) => {
    const lines = [];
    for (const line of input.lines) {
      const product = await loadProduct(line.productId);
      const qty = Math.floor(line.qty);
      if (!(qty > 0)) throw new ApiError(400, `Quantity for ${product.name} must be at least 1`);
      const serials = [...new Set((line.serials || []).map((s) => s.trim()).filter(Boolean))];
      if (product.serialTracking && serials.length !== qty) {
        throw new ApiError(400, `${product.name} is serial-tracked: enter ${qty} serial number${qty === 1 ? '' : 's'}`);
      }
      if (!product.serialTracking && serials.length && serials.length !== qty) {
        throw new ApiError(400, `Enter ${qty} serial numbers for ${product.name}, or none`);
      }

      // Decide each unit's bucket
      const groups: Record<UnitResult, string[] | number> = { available: 0, defective: 0, underRepair: 0, awaitingInspection: 0 };
      const faults: Record<string, string | undefined> = {};
      if (serials.length && line.unitResults?.length) {
        const bySerial = new Map(line.unitResults.map((u) => [u.serial.trim(), u]));
        const g: Record<UnitResult, string[]> = { available: [], defective: [], underRepair: [], awaitingInspection: [] };
        for (const serial of serials) {
          const r = bySerial.get(serial);
          g[r?.result || (settings.requireInspection ? 'awaitingInspection' : 'available')].push(serial);
          if (r?.fault) faults[serial] = r.fault;
        }
        Object.assign(groups, g);
      } else {
        const r = line.result;
        const inspected = r && (r.available || r.defective || r.underRepair);
        const available = inspected ? Math.max(0, Math.floor(r!.available || 0)) : settings.requireInspection ? 0 : qty;
        const defective = Math.max(0, Math.floor(r?.defective || 0));
        const underRepair = Math.max(0, Math.floor(r?.underRepair || 0));
        if (available + defective + underRepair > qty) {
          throw new ApiError(400, `Inspection results for ${product.name} add up to more than the ${qty} units received`);
        }
        const counts = { available, defective, underRepair, awaitingInspection: qty - available - defective - underRepair };
        if (serials.length) {
          let i = 0;
          for (const key of ['available', 'defective', 'underRepair', 'awaitingInspection'] as UnitResult[]) {
            groups[key] = serials.slice(i, i + counts[key]);
            i += counts[key];
          }
        } else {
          Object.assign(groups, counts);
        }
      }
      const countOf = (k: UnitResult) => (Array.isArray(groups[k]) ? (groups[k] as string[]).length : (groups[k] as number));
      lines.push({
        product,
        qty,
        serials,
        unitCost: typeof line.unitCost === 'number' ? roundMoney(line.unitCost) : undefined,
        warranty: line.warranty,
        faultNotes: line.faultNotes,
        groups,
        faults,
        result: {
          available: countOf('available'),
          defective: countOf('defective'),
          underRepair: countOf('underRepair'),
          awaitingInspection: countOf('awaitingInspection'),
        },
      });
    }

    const [receipt] = await SupplierReceipt.create(
      [
        {
          supplier: input.supplier.trim(),
          reference: input.reference?.trim() || undefined,
          receivedAt: input.receivedAt || new Date(),
          location: input.location,
          notes: input.notes,
          evidenceUrls: input.evidenceUrls || [],
          lines: lines.map((l) => ({
            product: l.product._id,
            name: l.product.name,
            sku: l.product.sku,
            qty: l.qty,
            unitCost: l.unitCost,
            serials: l.serials,
            warranty: l.warranty,
            result: l.result,
            faultNotes: l.faultNotes,
          })),
          by: actor.id,
        },
      ],
      { session }
    );

    for (const [index, l] of lines.entries()) {
      for (const bucket of ['available', 'defective', 'underRepair', 'awaitingInspection'] as UnitResult[]) {
        const group = l.groups[bucket];
        const qty = Array.isArray(group) ? group.length : group;
        if (!qty) continue;
        await moveStock(
          {
            product: l.product._id,
            qty,
            from: 'external',
            to: bucket,
            type: 'supplier-receipt',
            reason: `Delivery from ${input.supplier.trim()}${input.reference ? ` (${input.reference.trim()})` : ''}`,
            serials: Array.isArray(group) ? group : undefined,
            unitCost: l.unitCost,
            receipt: receipt._id,
            by: actor.id,
            idempotencyKey: `receipt:${receipt._id}:${index}:${bucket}`,
            unitDetails: { location: input.location, warranty: l.warranty },
          },
          session
        );
        if (bucket === 'underRepair') {
          const serialList = Array.isArray(group) ? group : [];
          const records = serialList.length
            ? serialList.map((serial) => ({ serial, qty: 1, fault: l.faults[serial] }))
            : [{ serial: undefined, qty, fault: undefined }];
          await RepairRecord.create(
            records.map((r) => ({
              product: l.product._id,
              name: l.product.name,
              sku: l.product.sku,
              qty: r.qty,
              serial: r.serial,
              source: 'receipt',
              receipt: receipt._id,
              reportedFault: r.fault || l.faultNotes || 'Found faulty during delivery inspection',
              history: [{ status: 'awaiting-diagnosis', note: 'Created from delivery inspection', at: new Date(), by: actor.id }],
            })),
            { session, ordered: true }
          );
        }
      }
    }
    return receipt;
  });
}

/* ------------------------------------------------------------------ */
/* Condition changes, adjustments, write-offs                           */
/* ------------------------------------------------------------------ */

/** Allowed manual moves. Units under repair or reserved only move through repairs / orders. */
const ALLOWED: Record<string, (Bucket | 'custom')[]> = {
  awaitingInspection: ['available', 'defective', 'underRepair', 'writtenOff', 'custom'],
  defective: ['underRepair', 'writtenOff', 'custom'],
  available: ['defective', 'underRepair', 'awaitingInspection', 'writtenOff', 'custom'],
  custom: ['available', 'defective', 'underRepair', 'writtenOff', 'custom'],
};

export async function changeCondition(
  input: { productId: string; from: Bucket; to: Bucket; qty: number; serials?: string[]; reason: string; fault?: string },
  actor: Actor
) {
  const fromKey = input.from.startsWith('custom:') ? 'custom' : input.from;
  const toKey = input.to.startsWith('custom:') ? 'custom' : input.to;
  const allowed = ALLOWED[fromKey];
  if (!allowed || !allowed.includes(toKey as Bucket)) {
    const hint = input.from === 'returned' ? ' — assess returned units from the return record'
      : input.from === 'underRepair' ? ' — finish the repair and its quality check instead'
      : input.from === 'reserved' ? ' — reserved units follow their order' : '';
    throw new ApiError(400, `Units cannot move from “${input.from}” to “${input.to}”${hint}`);
  }
  await assertCustomStatus(input.from);
  await assertCustomStatus(input.to);
  if (input.to === 'writtenOff') requireApproval(actor, 'Writing off stock');
  if (input.to === 'available' && fromKey === 'custom') requireApproval(actor, 'Making these units sellable');
  const product = await loadProduct(input.productId);

  return withTransaction(async (session) => {
    const res = await moveStock(
      {
        product: product._id,
        qty: input.qty,
        from: input.from,
        to: input.to,
        type: input.to === 'writtenOff' ? 'write-off' : input.to === 'underRepair' ? 'repair-transfer' : 'condition-change',
        reason: input.reason,
        serials: input.serials,
        by: actor.id,
      },
      session
    );
    if (input.to === 'underRepair') {
      const serials = input.serials?.length ? input.serials : [];
      await RepairRecord.create(
        (serials.length ? serials.map((s) => ({ serial: s, qty: 1 })) : [{ serial: undefined, qty: input.qty }]).map((r) => ({
          product: product._id,
          name: product.name,
          sku: product.sku,
          qty: r.qty,
          serial: r.serial,
          source: 'stock',
          reportedFault: input.fault?.trim() || input.reason,
          history: [{ status: 'awaiting-diagnosis', note: input.reason, at: new Date(), by: actor.id }],
        })),
        { session, ordered: true }
      );
    }
    return res;
  });
}

/** Correct a count after a physical stock-take. Always needs a reason and approval rights. */
export async function adjustStock(
  input: { productId: string; bucket: Bucket; delta: number; reason: string; unitCost?: number },
  actor: Actor
) {
  requireApproval(actor, 'Adjusting stock');
  if (input.bucket === 'reserved' || input.bucket === 'external') throw new ApiError(400, 'Reserved units follow their orders');
  await assertCustomStatus(input.bucket);
  const delta = Math.trunc(input.delta);
  if (!delta) throw new ApiError(400, 'Enter how many units to add or remove');
  return withTransaction((session) =>
    moveStock(
      {
        product: input.productId,
        qty: Math.abs(delta),
        from: delta > 0 ? 'external' : input.bucket,
        to: delta > 0 ? input.bucket : 'external',
        type: 'stock-adjustment',
        reason: input.reason,
        unitCost: delta > 0 ? input.unitCost : undefined,
        by: actor.id,
      },
      session
    )
  );
}

/* ------------------------------------------------------------------ */
/* Condition listings (Refurbished / Used versions of a model)          */
/* ------------------------------------------------------------------ */

const CONDITION_LABEL: Record<ProductCondition, string> = { new: 'New', refurbished: 'Refurbished', used: 'Used' };

/** Creates a hidden Refurbished / Used listing from a new model (the admin sets its price, then activates it). */
export async function createConditionListing(productId: string, condition: 'refurbished' | 'used', price?: number) {
  const base = await Product.findById(productId);
  if (!base) throw new ApiError(404, 'Product not found');
  const root = base.baseProduct ? await Product.findById(base.baseProduct) : base;
  const model = root || base;
  const existing = await Product.findOne({ baseProduct: model._id, condition });
  if (existing) return existing;
  const name = `${model.name} — ${CONDITION_LABEL[condition]}`;
  let slug = slugify(name);
  if (await Product.exists({ slug })) slug = uniqueSlug(name, Date.now().toString(36));
  let sku = `${model.sku}-${condition === 'refurbished' ? 'R' : 'U'}`;
  if (await Product.exists({ sku })) sku = `${sku}${Date.now().toString(36).slice(-3).toUpperCase()}`;
  return Product.create({
    name,
    slug,
    sku,
    description: model.description,
    shortDescription: model.shortDescription,
    category: model.category,
    brand: model.brand,
    images: model.images,
    specs: model.specs,
    tags: model.tags,
    price: typeof price === 'number' && price > 0 ? price : model.price,
    stock: 0,
    condition,
    conditionNote:
      condition === 'refurbished'
        ? 'Professionally repaired and tested. Passed our quality check.'
        : 'Pre-owned unit, inspected and working. May show signs of use.',
    serialTracking: model.serialTracking,
    baseProduct: model._id,
    isActive: false,
  });
}

async function assertListing(targetId: string | undefined, condition: ProductCondition) {
  if (!targetId) throw new ApiError(400, `Choose the ${CONDITION_LABEL[condition].toLowerCase()} listing to move the units to`);
  const target = await Product.findById(targetId).select('condition name');
  if (!target) throw new ApiError(404, 'Listing not found');
  if ((target.condition || 'new') !== condition) {
    throw new ApiError(400, `${target.name} is not a ${CONDITION_LABEL[condition].toLowerCase()} listing`);
  }
  return target;
}

/* ------------------------------------------------------------------ */
/* Customer returns                                                     */
/* ------------------------------------------------------------------ */

/** Registers units a customer sent back. They wait in "returned" until someone assesses them. */
export async function createReturn(
  input: { orderId: string; returnedAt?: Date; lines: { productId: string; qty: number; serials?: string[]; reason: string; conditionNote?: string }[] },
  actor: Actor
) {
  const order = await Order.findById(input.orderId).select('+items.unitCost');
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.orderStatus === 'cancelled' || !(order.stockDispatched || order.orderStatus === 'shipped' || order.orderStatus === 'delivered')) {
    throw new ApiError(400, 'Only shipped or delivered orders can have returns');
  }
  const previous = await CustomerReturn.find({ order: order._id }).lean();
  const returnedQty = (productId: string) =>
    previous.reduce((sum, r) => sum + r.lines.filter((l) => String(l.product) === productId).reduce((a, l) => a + l.qty, 0), 0);

  const lines = input.lines.map((line) => {
    const item = order.items.find((i) => String(i.product) === line.productId);
    if (!item) throw new ApiError(400, 'That product is not part of this order');
    const left = item.qty - returnedQty(line.productId);
    const qty = Math.floor(line.qty);
    if (!(qty > 0) || qty > left) throw new ApiError(400, `You can return between 1 and ${left} unit${left === 1 ? '' : 's'} of ${item.name}`);
    if (item.serials?.length && line.serials?.length) {
      const bad = line.serials.filter((s) => !item.serials!.includes(s));
      if (bad.length) throw new ApiError(400, `Serial ${bad[0]} was not sold on this order`);
    }
    return { item, qty, serials: line.serials || [], reason: line.reason.trim(), conditionNote: line.conditionNote?.trim() };
  });

  return withTransaction(async (session) => {
    const [ret] = await CustomerReturn.create(
      [
        {
          order: order._id,
          orderNumber: order.orderNumber,
          customer: order.user,
          returnedAt: input.returnedAt || new Date(),
          lines: lines.map((l) => ({
            product: l.item.product,
            name: l.item.name,
            sku: l.item.sku,
            qty: l.qty,
            serials: l.serials,
            reason: l.reason,
            conditionNote: l.conditionNote,
            unitCost: l.item.unitCost,
          })),
          by: actor.id,
        },
      ],
      { session }
    );
    for (const [index, l] of lines.entries()) {
      await moveStock(
        {
          product: l.item.product,
          qty: l.qty,
          from: 'external',
          to: 'returned',
          type: 'customer-return',
          reason: `Returned from order #${order.orderNumber}: ${l.reason}`,
          serials: l.serials.length === l.qty ? l.serials : undefined,
          unitCost: l.item.unitCost,
          order: order._id,
          orderNumber: order.orderNumber,
          customerReturn: ret._id,
          by: actor.id,
          idempotencyKey: `return:${ret._id}:${index}`,
        },
        session
      );
      await Product.updateOne({ _id: l.item.product, soldCount: { $gte: l.qty } }, { $inc: { soldCount: -l.qty } }, { session });
    }
    order.timeline.push({
      status: order.orderStatus,
      note: `Return registered: ${lines.map((l) => `${l.qty} × ${l.item.name}`).join(', ')}`,
      at: new Date(),
    });
    await order.save({ session });
    return ret;
  });
}

/** Decides what happens to returned units. Nothing becomes sellable without this step. */
export async function assessReturn(
  returnId: string,
  input: { lineId: string; qty: number; outcome: ReturnOutcome; note?: string; targetProductId?: string; meetsNewCriteria?: boolean; serials?: string[] },
  actor: Actor
) {
  const ret = await CustomerReturn.findById(returnId);
  if (!ret) throw new ApiError(404, 'Return not found');
  const line = ret.lines.find((l) => String((l as unknown as { _id: Types.ObjectId })._id) === input.lineId);
  if (!line) throw new ApiError(404, 'Return line not found');
  const left = line.qty - line.assessed.reduce((a, x) => a + x.qty, 0);
  const qty = Math.floor(input.qty);
  if (!(qty > 0) || qty > left) throw new ApiError(400, `Assess between 1 and ${left} unit${left === 1 ? '' : 's'}`);
  const product = await loadProduct(line.product);
  const reason = `Return #${ret.orderNumber} assessed: ${input.note?.trim() || input.outcome}`;
  const base = { product: product._id, qty, from: 'returned' as Bucket, reason, serials: input.serials, customerReturn: ret._id, order: ret.order, orderNumber: ret.orderNumber, by: actor.id };

  if (input.outcome === 'write-off') requireApproval(actor, 'Writing off stock');
  if (input.outcome === 'restock-new' && (product.condition || 'new') === 'new' && !input.meetsNewCriteria) {
    throw new ApiError(400, 'Confirm the unit is unopened / as new before restocking it as New');
  }
  const target = input.outcome === 'used' ? await assertListing(input.targetProductId, 'used') : null;

  await withTransaction(async (session) => {
    switch (input.outcome) {
      case 'restock-new':
        await moveStock({ ...base, to: 'available', type: 'condition-change' }, session);
        break;
      case 'used':
        await transferBetweenListings({ ...base, type: 'listing-transfer', fromProduct: product._id, toProduct: target!._id }, session);
        break;
      case 'repair': {
        await moveStock({ ...base, to: 'underRepair', type: 'repair-transfer' }, session);
        const serials = input.serials?.length ? input.serials : [];
        await RepairRecord.create(
          (serials.length ? serials.map((s) => ({ serial: s, qty: 1 })) : [{ serial: undefined, qty }]).map((r) => ({
            product: product._id,
            name: product.name,
            sku: product.sku,
            qty: r.qty,
            serial: r.serial,
            source: 'return',
            customerReturn: ret._id,
            reportedFault: line.reason,
            history: [{ status: 'awaiting-diagnosis', note: 'From customer return', at: new Date(), by: actor.id }],
          })),
          { session, ordered: true }
        );
        break;
      }
      case 'defective':
        await moveStock({ ...base, to: 'defective', type: 'condition-change' }, session);
        break;
      case 'write-off':
        await moveStock({ ...base, to: 'writtenOff', type: 'write-off' }, session);
        break;
    }
    line.assessed.push({ qty, outcome: input.outcome, note: input.note, targetProduct: target?._id, at: new Date(), by: actor.id as never });
    if (ret.lines.every((l) => l.qty === l.assessed.reduce((a, x) => a + x.qty, 0))) ret.status = 'assessed';
    await ret.save({ session });
  });
  return ret;
}

/* ------------------------------------------------------------------ */
/* Repairs                                                               */
/* ------------------------------------------------------------------ */

const WORK_STATUSES: RepairStatus[] = ['awaiting-diagnosis', 'awaiting-parts', 'in-repair', 'repair-completed', 'qc-pending'];

export async function updateRepair(
  id: string,
  input: { status?: RepairStatus; diagnosis?: string; cost?: number; technician?: string; partsReplaced?: string[]; note?: string },
  actor: Actor
) {
  const repair = await RepairRecord.findById(id);
  if (!repair) throw new ApiError(404, 'Repair not found');
  if (repair.closed) throw new ApiError(400, 'This repair is closed');
  if (input.status && !WORK_STATUSES.includes(input.status)) throw new ApiError(400, 'Use the quality check to pass or fail a repair');
  if (input.diagnosis !== undefined) repair.diagnosis = input.diagnosis.trim();
  if (input.cost !== undefined) repair.cost = roundMoney(Math.max(0, input.cost));
  if (input.technician !== undefined) repair.technician = input.technician.trim();
  if (input.partsReplaced !== undefined) repair.partsReplaced = input.partsReplaced.map((p) => p.trim()).filter(Boolean).slice(0, 30);
  if (input.status && input.status !== repair.status) {
    repair.status = input.status;
    if (input.status === 'in-repair' && !repair.startedAt) repair.startedAt = new Date();
    if (input.status === 'repair-completed') repair.completedAt = new Date();
    repair.history.push({ status: input.status, note: input.note?.trim(), at: new Date(), by: actor.id as never });
  } else if (input.note?.trim()) {
    repair.history.push({ status: repair.status, note: input.note.trim(), at: new Date(), by: actor.id as never });
  }
  await repair.save();
  return repair;
}

/**
 * Quality check. Passed units only become sellable with approval rights, into a listing that
 * matches their condition (New / Refurbished / Used). Failed units go to Defective or are written off.
 */
export async function completeRepair(
  id: string,
  input: { qcResult: 'passed' | 'failed'; finalStatus: 'new' | 'refurbished' | 'used' | 'defective' | 'write-off'; targetProductId?: string; qcNote?: string },
  actor: Actor
) {
  const repair = await RepairRecord.findById(id);
  if (!repair) throw new ApiError(404, 'Repair not found');
  if (repair.closed) throw new ApiError(400, 'This repair is already closed');
  if (!['repair-completed', 'qc-pending'].includes(repair.status)) {
    throw new ApiError(400, 'Mark the repair as completed before the quality check');
  }
  const passed = input.qcResult === 'passed';
  if (passed && !['new', 'refurbished', 'used'].includes(input.finalStatus)) throw new ApiError(400, 'Choose how the unit will be sold');
  if (!passed && !['defective', 'write-off'].includes(input.finalStatus)) throw new ApiError(400, 'A failed unit goes to Defective or is written off');
  if (passed) requireApproval(actor, 'Approving a repaired unit for sale');
  if (input.finalStatus === 'write-off') requireApproval(actor, 'Writing off stock');

  const product = await loadProduct(repair.product);
  if (input.finalStatus === 'new' && (product.condition || 'new') !== 'new') {
    throw new ApiError(400, 'Only units of a New listing can go back as New');
  }
  const target =
    input.finalStatus === 'refurbished' || input.finalStatus === 'used'
      ? await assertListing(input.targetProductId, input.finalStatus)
      : null;
  const reason = `Repair ${passed ? 'passed' : 'failed'} quality check${input.qcNote ? `: ${input.qcNote.trim()}` : ''}`;
  const serials = repair.serial ? [repair.serial] : undefined;
  const base = { product: product._id, qty: repair.qty, from: 'underRepair' as Bucket, reason, serials, repair: repair._id, by: actor.id, idempotencyKey: `repair:${repair._id}:close` };

  await withTransaction(async (session) => {
    if (target) {
      await transferBetweenListings(
        { ...base, type: 'repair-completion', fromProduct: product._id, toProduct: target._id, extraCostPerUnit: repair.cost / repair.qty },
        session
      );
    } else if (input.finalStatus === 'new') {
      await moveStock({ ...base, to: 'available', type: 'repair-completion' }, session);
    } else {
      await moveStock({ ...base, to: input.finalStatus === 'write-off' ? 'writtenOff' : 'defective', type: input.finalStatus === 'write-off' ? 'write-off' : 'repair-completion' }, session);
    }
    repair.status = passed ? 'qc-passed' : 'qc-failed';
    repair.qcResult = input.qcResult;
    repair.qcNote = input.qcNote?.trim();
    repair.qcBy = actor.id as never;
    repair.finalStatus = input.finalStatus;
    repair.finalProduct = target?._id ?? product._id;
    repair.closed = true;
    repair.completedAt = repair.completedAt || new Date();
    repair.history.push({ status: repair.status, note: reason, at: new Date(), by: actor.id as never });
    await repair.save({ session });
  });
  return repair;
}

/** Register serial numbers for units that already exist on a serial-tracked product. */
export async function registerSerials(input: { productId: string; bucket: Bucket; serials: string[]; location?: string }, actor: Actor) {
  const product = await Product.findById(input.productId).select('+inventory stock serialTracking name');
  if (!product) throw new ApiError(404, 'Product not found');
  if (!product.serialTracking) throw new ApiError(400, 'Turn on serial tracking for this product first');
  const serials = [...new Set(input.serials.map((s) => s.trim()).filter(Boolean))];
  await assertCustomStatus(input.bucket);
  const count = bucketCount(product.toObject() as never, input.bucket);
  const tracked = await InventoryUnit.countDocuments({ product: product._id, status: input.bucket });
  if (tracked + serials.length > count) {
    throw new ApiError(400, `Only ${count - tracked} untracked unit${count - tracked === 1 ? '' : 's'} in this status`);
  }
  try {
    await InventoryUnit.insertMany(serials.map((serial) => ({ product: product._id, serial, status: input.bucket, location: input.location, notes: `Registered by staff ${actor.id}` })));
  } catch (e) {
    if ((e as { code?: number }).code === 11000) throw new ApiError(409, 'One of these serial numbers is already registered');
    throw e;
  }
  return { registered: serials.length };
}
