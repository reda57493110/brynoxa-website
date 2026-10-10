import mongoose, { Types } from 'mongoose';
import { Product } from '../models/Product';
import { getSettings } from '../models/Settings';
import {
  CustomerReturn,
  InventoryUnit,
  RepairRecord,
  StockMovement,
  SupplierReceipt,
  type MovementType,
} from '../models/Inventory';
import { ApiError } from '../utils/ApiError';
import { roundMoney } from '../utils/deposit';

const BUCKET_KEYS = ['reserved', 'awaitingInspection', 'returned', 'defective', 'underRepair', 'writtenOff'] as const;

/** Variants share a name; add their options so each one is recognisable. */
const displayName = (p: { name: string; variantLabel?: string }) => (p.variantLabel ? `${p.name} (${p.variantLabel})` : p.name);

type LeanProduct = {
  _id: Types.ObjectId;
  name: string;
  variantLabel?: string;
  sku: string;
  slug: string;
  price: number;
  costPrice?: number;
  stock: number;
  lowStockThreshold: number;
  condition?: 'new' | 'refurbished' | 'used';
  serialTracking?: boolean;
  isActive: boolean;
  inventoryLocation?: string;
  baseProduct?: Types.ObjectId;
  category?: { name?: string };
  images?: { url: string; isPrimary?: boolean }[];
  inventory?: Partial<Record<(typeof BUCKET_KEYS)[number] | 'uncosted', number>> & { custom?: Record<string, number> };
};

/** Bucket counts, physical vs sellable split, and value (only where cost is known). */
export function inventorySnapshot(p: LeanProduct) {
  const inv = p.inventory || {};
  const custom = inv.custom || {};
  const buckets = {
    available: p.stock || 0,
    reserved: inv.reserved || 0,
    awaitingInspection: inv.awaitingInspection || 0,
    returned: inv.returned || 0,
    defective: inv.defective || 0,
    underRepair: inv.underRepair || 0,
    writtenOff: inv.writtenOff || 0,
  };
  const customTotal = Object.values(custom).reduce((a, b) => a + (b || 0), 0);
  const physical = buckets.available + buckets.reserved + buckets.awaitingInspection + buckets.returned + buckets.defective + buckets.underRepair + customTotal;
  // Products that predate the ledger: existing stock has no cost unless a cost price was set
  const uncosted = p.inventory ? inv.uncosted || 0 : typeof p.costPrice === 'number' ? 0 : physical;
  const cost = typeof p.costPrice === 'number' ? p.costPrice : null;
  const costedUnits = Math.max(0, physical - uncosted);
  const valueOf = (units: number) => (cost === null ? null : roundMoney(Math.max(0, units - Math.min(units, uncosted)) * cost));
  return {
    buckets,
    custom,
    physical,
    sellable: buckets.available,
    nonSellable: physical - buckets.available,
    uncostedUnits: uncosted,
    unitCost: cost,
    value: cost === null ? null : roundMoney(costedUnits * cost),
    defectiveValue: valueOf(buckets.defective),
    lowStock: buckets.available <= (p.lowStockThreshold ?? 5),
  };
}

const PRODUCT_FIELDS = '+inventory +costPrice name variantLabel sku slug price stock lowStockThreshold condition serialTracking isActive inventoryLocation baseProduct category images';

export interface InventoryQuery {
  page?: number;
  limit?: number;
  q?: string;
  serial?: string;
  condition?: string;
  location?: string;
  supplier?: string;
  status?: string;
  /** 'true' = active listings only, 'false' = inactive only */
  active?: string;
  category?: string;
  sort?: 'name' | 'available' | 'physical' | 'value' | 'nonSellable';
  dir?: 'asc' | 'desc';
}

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function inventoryOverview(query: InventoryQuery) {
  const filter: Record<string, unknown> = {};
  if (query.q?.trim()) {
    const rx = new RegExp(escapeRegex(query.q.trim()), 'i');
    filter.$or = [{ name: rx }, { sku: rx }];
  }
  if (query.active === 'true') filter.isActive = true;
  if (query.active === 'false') filter.isActive = false;
  if (query.category && mongoose.Types.ObjectId.isValid(query.category)) filter.category = query.category;
  if (query.condition && ['new', 'refurbished', 'used'].includes(query.condition)) {
    filter.condition = query.condition === 'new' ? { $in: ['new', null] } : query.condition;
  }
  const idSets: Types.ObjectId[][] = [];
  if (query.serial?.trim()) {
    const units = await InventoryUnit.find({ serial: new RegExp(escapeRegex(query.serial.trim()), 'i') }).select('product').limit(200).lean();
    idSets.push(units.map((u) => u.product));
  }
  if (query.supplier?.trim()) {
    const receipts = await SupplierReceipt.find({ supplier: new RegExp(escapeRegex(query.supplier.trim()), 'i') }).select('lines.product').lean();
    idSets.push(receipts.flatMap((r) => r.lines.map((l) => l.product)));
  }
  if (query.location?.trim()) {
    const loc = query.location.trim();
    const units = await InventoryUnit.find({ location: loc }).select('product').lean();
    filter.$and = [{ $or: [{ inventoryLocation: loc }, { _id: { $in: units.map((u) => u.product) } }] }];
  }
  if (idSets.length) {
    const ids = idSets.reduce((acc, set) => acc.filter((id) => set.some((x) => String(x) === String(id))));
    filter._id = { $in: ids };
  }

  const products = await Product.find(filter).select(PRODUCT_FIELDS).populate('category', 'name').lean<LeanProduct[]>();
  let rows = products.map((p) => ({
    _id: p._id,
    name: displayName(p),
    sku: p.sku,
    slug: p.slug,
    price: p.price,
    condition: p.condition || 'new',
    serialTracking: Boolean(p.serialTracking),
    isActive: p.isActive,
    category: p.category?.name,
    location: p.inventoryLocation,
    lowStockThreshold: p.lowStockThreshold ?? 5,
    image: p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url,
    ...inventorySnapshot(p),
  }));

  switch (query.status) {
    case 'low': rows = rows.filter((r) => r.lowStock && r.sellable > 0); break;
    case 'out': rows = rows.filter((r) => r.sellable === 0); break;
    case 'in-stock': rows = rows.filter((r) => r.sellable > 0); break;
    case 'awaiting': rows = rows.filter((r) => r.buckets.awaitingInspection + r.buckets.returned > 0); break;
    case 'defective': rows = rows.filter((r) => r.buckets.defective > 0); break;
    case 'repair': rows = rows.filter((r) => r.buckets.underRepair > 0); break;
    case 'non-sellable': rows = rows.filter((r) => r.nonSellable > 0); break;
  }

  const dir = query.dir === 'asc' ? 1 : -1;
  const key = (r: (typeof rows)[number]) => {
    switch (query.sort) {
      case 'available': return r.sellable;
      case 'physical': return r.physical;
      case 'value': return r.value ?? -1;
      case 'nonSellable': return r.nonSellable;
      default: return r.name.toLowerCase();
    }
  };
  rows.sort((a, b) => {
    const ka = key(a), kb = key(b);
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * (query.sort ? dir : 1);
  });

  const limit = Math.min(Math.max(query.limit || 25, 1), 100);
  const page = Math.max(query.page || 1, 1);
  return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit };
}

/** Dashboard totals and business reports over all products. */
export async function inventorySummary() {
  const products = await Product.find({}).select(PRODUCT_FIELDS).lean<LeanProduct[]>();
  const snaps = products.map((p) => ({ p, s: inventorySnapshot(p) }));
  const sum = (fn: (x: (typeof snaps)[number]) => number) => snaps.reduce((a, x) => a + fn(x), 0);

  const valueByCondition: Record<string, { units: number; value: number; uncostedUnits: number }> = {};
  for (const { p, s } of snaps) {
    const key = p.condition || 'new';
    const row = (valueByCondition[key] ||= { units: 0, value: 0, uncostedUnits: 0 });
    row.units += s.physical;
    row.value = roundMoney(row.value + (s.value || 0));
    row.uncostedUnits += s.value === null ? s.physical : s.uncostedUnits;
  }

  const [writeOffs, returns, repairs, receipts, refurbAvailable] = await Promise.all([
    StockMovement.aggregate([
      { $match: { type: 'write-off' } },
      { $group: { _id: null, units: { $sum: '$qty' }, value: { $sum: { $multiply: ['$qty', { $ifNull: ['$unitCost', 0] }] } }, uncosted: { $sum: { $cond: [{ $ifNull: ['$unitCost', false] }, 0, '$qty'] } } } },
    ]),
    StockMovement.aggregate([{ $match: { type: 'customer-return' } }, { $group: { _id: null, units: { $sum: '$qty' } } }]),
    RepairRecord.aggregate([
      { $group: { _id: null, cost: { $sum: '$cost' }, closed: { $sum: { $cond: ['$closed', 1, 0] } }, passed: { $sum: { $cond: [{ $eq: ['$qcResult', 'passed'] }, 1, 0] } }, open: { $sum: { $cond: ['$closed', 0, 1] } } } },
    ]),
    SupplierReceipt.aggregate([
      { $unwind: '$lines' },
      {
        $group: {
          _id: '$supplier',
          units: { $sum: '$lines.qty' },
          defective: { $sum: { $add: ['$lines.result.defective', '$lines.result.underRepair'] } },
          deliveries: { $addToSet: '$_id' },
          lastDelivery: { $max: '$receivedAt' },
        },
      },
      { $sort: { units: -1 } },
    ]),
    Promise.resolve(sum(({ p, s }) => (p.condition === 'refurbished' ? s.sellable : 0))),
  ]);

  const repair = repairs[0] || { cost: 0, closed: 0, passed: 0, open: 0 };
  const settings = await getSettings();
  return {
    units: {
      physical: sum(({ s }) => s.physical),
      sellable: sum(({ s }) => s.sellable),
      nonSellable: sum(({ s }) => s.nonSellable),
      reserved: sum(({ s }) => s.buckets.reserved),
      awaitingInspection: sum(({ s }) => s.buckets.awaitingInspection),
      returned: sum(({ s }) => s.buckets.returned),
      defective: sum(({ s }) => s.buckets.defective),
      underRepair: sum(({ s }) => s.buckets.underRepair),
      writtenOff: sum(({ s }) => s.buckets.writtenOff),
      refurbishedAvailable: refurbAvailable,
      usedAvailable: sum(({ p, s }) => (p.condition === 'used' ? s.sellable : 0)),
      custom: settings.inventoryStatuses.map((st) => ({ ...st, units: sum(({ s }) => s.custom[st.id] || 0) })),
    },
    lowStockProducts: snaps.filter(({ p, s }) => s.lowStock && p.isActive).length,
    value: {
      total: roundMoney(sum(({ s }) => s.value || 0)),
      uncostedUnits: sum(({ s }) => (s.value === null ? s.physical : s.uncostedUnits)),
      byCondition: valueByCondition,
      defective: roundMoney(sum(({ s }) => s.defectiveValue || 0)),
    },
    reports: {
      writeOffs: { units: writeOffs[0]?.units || 0, value: roundMoney(writeOffs[0]?.value || 0), uncostedUnits: writeOffs[0]?.uncosted || 0 },
      customerReturns: { units: returns[0]?.units || 0 },
      repairs: {
        cost: roundMoney(repair.cost),
        open: repair.open,
        closed: repair.closed,
        successRate: repair.closed ? roundMoney((repair.passed / repair.closed) * 100) : null,
      },
      suppliers: receipts.map((r) => ({
        supplier: r._id as string,
        deliveries: (r.deliveries as unknown[]).length,
        units: r.units as number,
        faulty: r.defective as number,
        defectRate: r.units ? roundMoney(((r.defective as number) / (r.units as number)) * 100) : null,
        lastDelivery: r.lastDelivery as Date,
      })),
    },
    statuses: settings.inventoryStatuses,
    locations: settings.inventoryLocations,
    requireInspection: settings.requireInspection,
  };
}

/** Everything about one product's stock: buckets, value, units, deliveries, returns, repairs, ledger. */
export async function productInventory(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, 'Product not found');
  const p = await Product.findById(id).select(PRODUCT_FIELDS).populate('category', 'name').lean<LeanProduct>();
  if (!p) throw new ApiError(404, 'Product not found');
  const family = p.baseProduct ?? p._id;
  const [units, receipts, returns, repairs, movements, listings] = await Promise.all([
    p.serialTracking ? InventoryUnit.find({ product: p._id }).sort({ status: 1, createdAt: 1 }).limit(500).lean() : Promise.resolve([]),
    SupplierReceipt.find({ 'lines.product': p._id }).sort({ receivedAt: -1 }).limit(50).lean(),
    CustomerReturn.find({ 'lines.product': p._id }).sort({ createdAt: -1 }).limit(50).populate('customer', 'name email').lean(),
    RepairRecord.find({ product: p._id }).sort({ createdAt: -1 }).limit(100).lean(),
    StockMovement.find({ product: p._id }).sort({ createdAt: -1 }).limit(100).populate('by', 'name').lean(),
    Product.find({ $or: [{ _id: family }, { baseProduct: family }] }).select('name sku condition stock isActive price').lean(),
  ]);
  return {
    product: {
      _id: p._id, name: displayName(p), sku: p.sku, slug: p.slug, price: p.price, condition: p.condition || 'new',
      serialTracking: Boolean(p.serialTracking), isActive: p.isActive, location: p.inventoryLocation,
      lowStockThreshold: p.lowStockThreshold ?? 5, category: p.category?.name, baseProduct: p.baseProduct,
      image: p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url,
    },
    ...inventorySnapshot(p),
    untrackedUnits: p.serialTracking ? Math.max(0, inventorySnapshot(p).physical - units.filter((u) => u.status !== 'sold' && u.status !== 'writtenOff').length) : 0,
    units,
    receipts: receipts.map((r) => ({
      _id: r._id, supplier: r.supplier, reference: r.reference, receivedAt: r.receivedAt,
      line: r.lines.find((l) => String(l.product) === String(p._id)),
    })),
    returns: returns.map((r) => ({
      _id: r._id, orderNumber: r.orderNumber, order: r.order, customer: r.customer, returnedAt: r.returnedAt, status: r.status,
      line: r.lines.find((l) => String(l.product) === String(p._id)),
    })),
    repairs,
    movements,
    /** The New / Refurbished / Used listings of the same model. */
    listings,
  };
}

const page = (q: { page?: number; limit?: number }) => {
  const limit = Math.min(Math.max(Number(q.limit) || 20, 1), 100);
  const p = Math.max(Number(q.page) || 1, 1);
  return { limit, page: p, skip: (p - 1) * limit };
};

export async function listReceipts(q: { page?: number; limit?: number; supplier?: string }) {
  const { limit, page: p, skip } = page(q);
  const filter = q.supplier?.trim() ? { supplier: new RegExp(escapeRegex(q.supplier.trim()), 'i') } : {};
  const [items, total] = await Promise.all([
    SupplierReceipt.find(filter).sort({ receivedAt: -1 }).skip(skip).limit(limit).populate('by', 'name').lean(),
    SupplierReceipt.countDocuments(filter),
  ]);
  return { items, total, page: p, limit };
}

export async function listReturns(q: { page?: number; limit?: number; status?: string }) {
  const { limit, page: p, skip } = page(q);
  const filter = q.status === 'awaiting-assessment' || q.status === 'assessed' ? { status: q.status } : {};
  const [items, total] = await Promise.all([
    CustomerReturn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('customer', 'name email').lean(),
    CustomerReturn.countDocuments(filter),
  ]);
  return { items, total, page: p, limit };
}

export async function getReturn(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, 'Return not found');
  const ret = await CustomerReturn.findById(id).populate('customer', 'name email phone').populate('lines.assessed.targetProduct', 'name sku').lean();
  if (!ret) throw new ApiError(404, 'Return not found');
  return ret;
}

export async function listRepairs(q: { page?: number; limit?: number; status?: string; open?: string }) {
  const { limit, page: p, skip } = page(q);
  const filter: Record<string, unknown> = {};
  if (q.open === 'true') filter.closed = false;
  if (q.open === 'false') filter.closed = true;
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    RepairRecord.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    RepairRecord.countDocuments(filter),
  ]);
  return { items, total, page: p, limit };
}

export async function getRepair(id: string): Promise<Record<string, unknown>> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, 'Repair not found');
  const repair = await RepairRecord.findById(id)
    .populate('history.by', 'name')
    .populate('qcBy', 'name')
    .populate('finalProduct', 'name sku condition')
    .lean();
  if (!repair) throw new ApiError(404, 'Repair not found');
  const listings = await Product.find({ $or: [{ _id: repair.product }, { baseProduct: repair.product }] })
    .select('name sku condition baseProduct')
    .lean();
  const base = await Product.findById(repair.product).select('baseProduct').lean();
  const siblings = base?.baseProduct
    ? await Product.find({ $or: [{ _id: base.baseProduct }, { baseProduct: base.baseProduct }] }).select('name sku condition').lean()
    : listings;
  return { ...repair, listings: siblings };
}

export async function listMovements(q: { page?: number; limit?: number; product?: string; type?: string; from?: Date; to?: Date }) {
  const { limit, page: p, skip } = page(q);
  const filter: Record<string, unknown> = {};
  if (q.product && mongoose.Types.ObjectId.isValid(q.product)) filter.product = q.product;
  if (q.type) filter.type = q.type as MovementType;
  if (q.from || q.to) filter.createdAt = { ...(q.from ? { $gte: q.from } : {}), ...(q.to ? { $lte: q.to } : {}) };
  const [items, total] = await Promise.all([
    StockMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('by', 'name').populate('product', 'name sku condition').lean(),
    StockMovement.countDocuments(filter),
  ]);
  return { items, total, page: p, limit };
}
