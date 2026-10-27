import mongoose from 'mongoose';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { Expense, EXPENSE_CATEGORIES, type ExpenseCategory } from '../models/Expense';
import { getSettings, getSettingsCached } from '../models/Settings';
import { ORDER_STATUS_GROUP, wasDelivered, type OrderStatus } from '../utils/orderStatus';
import { feeCreditOf, roundMoney } from '../utils/deposit';
import { ApiError } from '../utils/ApiError';
import { ORDER_ORIGINS, type OrderOrigin } from '../utils/orderOrigin';
import { STORE_TIMEZONE, dayKeys, localDay, type SalesRange } from './dashboard.service';

/**
 * Admin → Profit: what the shop really earned. Per order:
 *   money in   = what the customer paid (total − refunds − transfer fees the shop covered);
 *                on a parcel that was not delivered, a deposit the shop kept
 *   − product cost  (unit cost × units not returned)
 *   − delivery cost (per-order amount, else the default courier price: delivered / returned)
 *   − other costs   (per order, e.g. packaging, a gift)
 * Then the expenses that are not tied to one order (ads, rent…) come off the total.
 * Orders still being prepared or on the way are listed but not counted until they finish.
 * Days are the day each order was placed (store timezone), like the dashboard.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DONE_EPSILON = 0.005;

export type ProfitOrderKind = 'sale' | 'failed' | 'open' | 'cancelled';

type LeanOrder = {
  _id: unknown;
  orderNumber: string;
  createdAt: Date;
  orderStatus: OrderStatus;
  origin?: OrderOrigin;
  deliveredAt?: Date | null;
  pricing: { total: number; shipping: number; discount: number };
  items: { product: unknown; name: string; price: number; qty: number; unitCost?: number; returnedQty?: number }[];
  refunds?: { amount: number }[];
  deposit?: { amount: number; status: 'pending' | 'received'; feeCredit?: number; payment?: { fee?: number } } | null;
  costs?: { delivery?: number; other?: number; note?: string } | null;
  shippingAddress?: { fullName?: string; city?: string };
};

type CourierCosts = { delivered: number; returned: number };

function kindOf(o: LeanOrder, refunded: number): ProfitOrderKind {
  const group = ORDER_STATUS_GROUP[o.orderStatus];
  if (o.orderStatus === 'cancelled') return 'cancelled';
  if (wasDelivered(o)) return refunded < o.pricing.total - DONE_EPSILON ? 'sale' : 'failed';
  // Sent back without being delivered (refused, failed): finished, nothing sold
  if (group === 'returns') return 'failed';
  return 'open';
}

type UnitCosts = Map<string, { delivery?: number; other?: number }>;

function orderFigures(o: LeanOrder, courier: CourierCosts, unitCosts: UnitCosts) {
  const refunded = roundMoney((o.refunds ?? []).reduce((a, r) => a + r.amount, 0));
  const kind = kindOf(o, refunded);
  const fees = kind === 'sale' ? feeCreditOf(o.deposit) : 0;
  const depositKept = o.deposit?.status === 'received' ? o.deposit.amount : 0;
  const moneyIn =
    kind === 'sale'
      ? roundMoney(o.pricing.total - refunded - fees)
      : kind === 'failed' || kind === 'cancelled'
        ? roundMoney(Math.max(0, depositKept - refunded))
        : 0;

  let productCost = 0;
  let missingCost = false;
  for (const i of o.items) {
    const kept = Math.max(0, i.qty - (i.returnedQty ?? 0));
    if (!kept) continue;
    if (typeof i.unitCost === 'number') productCost += i.unitCost * kept;
    else missingCost = true;
  }
  // Nothing left the shop on a cancelled order; a parcel that came back is back in stock
  if (kind !== 'sale') {
    productCost = 0;
    missingCost = false;
  }

  // Product-level costs (Product costs sheet): one parcel, so the highest delivery price set on
  // its products; other costs per unit kept
  let productDelivery: number | undefined;
  let productOther = 0;
  for (const i of o.items) {
    const u = unitCosts.get(String(i.product));
    if (!u) continue;
    if (typeof u.delivery === 'number') productDelivery = Math.max(productDelivery ?? 0, u.delivery);
    productOther += (u.other ?? 0) * Math.max(0, i.qty - (i.returnedQty ?? 0));
  }

  const customDelivery = typeof o.costs?.delivery === 'number';
  const delivery = customDelivery
    ? o.costs!.delivery!
    : kind === 'sale'
      ? (productDelivery ?? courier.delivered)
      : kind === 'failed'
        ? courier.returned
        : 0;
  const other = o.costs?.other ?? (kind === 'sale' ? productOther : 0);
  const counted = kind !== 'open';
  const profit = counted ? roundMoney(moneyIn - productCost - delivery - other) : 0;

  return {
    id: String(o._id),
    orderNumber: o.orderNumber,
    day: localDay(o.createdAt),
    createdAt: o.createdAt,
    status: o.orderStatus,
    // Orders from before the field existed came from the website
    origin: o.origin || 'website',
    kind,
    customer: o.shippingAddress?.fullName ?? '',
    city: o.shippingAddress?.city ?? '',
    total: o.pricing.total,
    shippingCharged: o.pricing.shipping || 0,
    refunded,
    moneyIn,
    productCost: roundMoney(productCost),
    missingCost,
    delivery: roundMoney(delivery),
    deliveryIsDefault: !customDelivery,
    fees: roundMoney(fees),
    other: roundMoney(other),
    note: o.costs?.note ?? '',
    profit,
  };
}

type OrderFigures = ReturnType<typeof orderFigures>;

function totalsOf(rows: OrderFigures[], expenses: number) {
  const counted = rows.filter((r) => r.kind !== 'open');
  const sum = (pick: (r: OrderFigures) => number, list = counted) => roundMoney(list.reduce((a, r) => a + pick(r), 0));
  const sales = counted.filter((r) => r.kind === 'sale');
  const failed = counted.filter((r) => r.kind === 'failed');
  const moneyIn = sum((r) => r.moneyIn);
  const orderProfit = sum((r) => r.profit);
  const net = roundMoney(orderProfit - expenses);
  return {
    moneyIn,
    sales: sales.length,
    salesValue: sum((r) => r.moneyIn, sales),
    productCost: sum((r) => r.productCost),
    delivery: sum((r) => r.delivery),
    fees: sum((r) => r.fees),
    other: sum((r) => r.other),
    shippingCharged: sum((r) => r.shippingCharged, sales),
    refunds: sum((r) => r.refunded),
    failed: failed.length,
    /** What failed deliveries cost (courier, other) minus deposits kept */
    failedLoss: roundMoney(-sum((r) => r.profit, failed)),
    orderProfit,
    expenses: roundMoney(expenses),
    netProfit: net,
    margin: moneyIn > 0 ? Math.round((net / moneyIn) * 1000) / 10 : null,
    salesMissingCost: sales.filter((r) => r.missingCost).length,
    open: rows.filter((r) => r.kind === 'open').length,
    openValue: sum((r) => r.total, rows.filter((r) => r.kind === 'open')),
  };
}

async function courierCosts(): Promise<CourierCosts> {
  const s = await getSettingsCached();
  return { delivered: s.courierCosts?.delivered ?? 0, returned: s.courierCosts?.returned ?? 0 };
}

/** Orders placed in the last `days` × `periods` days (a little margin for the timezone). */
async function ordersSince(daysBack: number) {
  return Order.find({ createdAt: { $gte: new Date(Date.now() - (daysBack + 2) * DAY_MS) } })
    // The money fields only: no history, calls or notes (most of an order's size)
    .select('+items.unitCost +costs -timeline -contactAttempts -customerNote -adminNote -deliveryIssue')
    .sort({ createdAt: -1 })
    .lean<LeanOrder[]>();
}

async function expensesSince(daysBack: number) {
  return Expense.find({ date: { $gte: new Date(Date.now() - (daysBack + 2) * DAY_MS) } })
    .sort({ date: -1, createdAt: -1 })
    .lean<{ _id: unknown; label: string; category: ExpenseCategory; amount: number; date: Date; note?: string }[]>();
}

/** Per-unit delivery / other costs set on the products of these orders. */
async function unitCostsFor(orders: LeanOrder[]): Promise<UnitCosts> {
  const ids = [...new Set(orders.flatMap((o) => o.items.map((i) => String(i.product))))].filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (!ids.length) return new Map();
  const docs = await Product.find({ _id: { $in: ids }, unitCosts: { $exists: true } })
    .select('+unitCosts')
    .lean<{ _id: unknown; unitCosts?: { delivery?: number; other?: number } }[]>();
  return new Map(docs.filter((d) => d.unitCosts).map((d) => [String(d._id), d.unitCosts!]));
}

/** Net profit of the period and the one before (dashboard card). */
export async function profitSummary(range: SalesRange) {
  const [orders, expenses, courier] = await Promise.all([ordersSince(range * 2), expensesSince(range * 2), courierCosts()]);
  const unitCosts = await unitCostsFor(orders);
  const rows = orders.map((o) => orderFigures(o, courier, unitCosts));
  const period = (keys: string[]) => {
    const days = new Set(keys);
    const spent = expenses.filter((e) => days.has(localDay(e.date))).reduce((a, e) => a + e.amount, 0);
    return totalsOf(rows.filter((r) => days.has(r.day)), spent);
  };
  return { range, current: period(dayKeys(range)), previous: period(dayKeys(range, range)) };
}

/** Everything on Admin → Profit for the last `range` days. */
export async function profitReport(range: SalesRange) {
  const keys = dayKeys(range);
  const days = new Set(keys);
  const [orders, expenseDocs, courier, uncosted] = await Promise.all([
    ordersSince(range),
    expensesSince(range),
    courierCosts(),
    Product.find({ isActive: true, costPrice: { $exists: false } })
      .select('name slug price sku images')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean<{ _id: unknown; name: string; slug: string; price: number; sku?: string; images?: { url: string; isPrimary?: boolean }[] }[]>(),
  ]);

  const unitCosts = await unitCostsFor(orders);
  const rows = orders.map((o) => orderFigures(o, courier, unitCosts)).filter((r) => days.has(r.day));
  const expenses = expenseDocs.filter((e) => days.has(localDay(e.date)));
  const spent = expenses.reduce((a, e) => a + e.amount, 0);

  // Per product, from finished sales (units kept by the customer)
  const byProduct = new Map<string, { productId: string; name: string; units: number; revenue: number; cost: number; missingCost: boolean }>();
  const saleIds = new Set(rows.filter((r) => r.kind === 'sale').map((r) => r.id));
  for (const o of orders) {
    if (!saleIds.has(String(o._id))) continue;
    for (const i of o.items) {
      const kept = Math.max(0, i.qty - (i.returnedQty ?? 0));
      if (!kept) continue;
      const key = String(i.product);
      const p = byProduct.get(key) ?? { productId: key, name: i.name, units: 0, revenue: 0, cost: 0, missingCost: false };
      p.units += kept;
      p.revenue += i.price * kept;
      if (typeof i.unitCost === 'number') p.cost += i.unitCost * kept;
      else p.missingCost = true;
      byProduct.set(key, p);
    }
  }
  const productIds = [...byProduct.keys()].filter((id) => mongoose.Types.ObjectId.isValid(id));
  const productDocs = await Product.find({ _id: { $in: productIds } })
    .select('slug images +costPrice')
    .lean<{ _id: unknown; slug: string; costPrice?: number; images?: { url: string; isPrimary?: boolean }[] }[]>();
  const docById = new Map(productDocs.map((p) => [String(p._id), p]));
  const products = [...byProduct.values()]
    .map((p) => {
      const doc = docById.get(p.productId);
      const revenue = roundMoney(p.revenue);
      const cost = roundMoney(p.cost);
      return {
        ...p,
        revenue,
        cost,
        profit: roundMoney(revenue - cost),
        margin: revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null,
        slug: doc?.slug,
        image: (doc?.images?.find((i) => i.isPrimary) || doc?.images?.[0])?.url,
        costPrice: typeof doc?.costPrice === 'number' ? doc.costPrice : null,
        exists: Boolean(doc),
      };
    })
    .sort((a, b) => b.profit - a.profit);

  // Where the sales came from (website, social media, the shop…): finished orders only
  const bySource = ORDER_ORIGINS.map((origin) => {
    const list = rows.filter((r) => r.origin === origin && r.kind !== 'open');
    const sales = list.filter((r) => r.kind === 'sale');
    return {
      origin,
      sales: sales.length,
      moneyIn: roundMoney(list.reduce((a, r) => a + r.moneyIn, 0)),
      profit: roundMoney(list.reduce((a, r) => a + r.profit, 0)),
      open: rows.filter((r) => r.origin === origin && r.kind === 'open').length,
    };
  }).filter((s) => s.sales || s.open || s.moneyIn);

  const byCategory = EXPENSE_CATEGORIES.map((c) => ({
    category: c,
    amount: roundMoney(expenses.filter((e) => e.category === c).reduce((a, e) => a + e.amount, 0)),
  })).filter((c) => c.amount > 0);

  return {
    range,
    timezone: STORE_TIMEZONE,
    from: keys[0],
    to: keys[keys.length - 1],
    courierCosts: courier,
    totals: totalsOf(rows, spent),
    orders: rows,
    products,
    bySource,
    expenses: expenses.map((e) => ({
      id: String(e._id),
      label: e.label,
      category: e.category,
      amount: e.amount,
      day: localDay(e.date),
      note: e.note ?? '',
    })),
    expensesByCategory: byCategory,
    productsWithoutCost: uncosted.map((p) => ({
      productId: String(p._id),
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      price: p.price,
      image: (p.images?.find((i) => i.isPrimary) || p.images?.[0])?.url,
    })),
  };
}

function money(value: unknown, field: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw new ApiError(400, `${field}: enter 0 or more`);
  return roundMoney(n);
}

/** Per-order costs. `null` clears a value (back to the default courier price / nothing). */
export async function setOrderCosts(orderId: string, input: { delivery?: number | null; other?: number | null; note?: string }) {
  if (!mongoose.Types.ObjectId.isValid(orderId)) throw new ApiError(404, 'Order not found');
  const order = await Order.findById(orderId).select('+costs');
  if (!order) throw new ApiError(404, 'Order not found');
  const costs = { ...(order.costs ?? {}) } as { delivery?: number; other?: number; note?: string };
  if (input.delivery !== undefined) {
    if (input.delivery === null) delete costs.delivery;
    else costs.delivery = money(input.delivery, 'Delivery cost');
  }
  if (input.other !== undefined) {
    if (input.other === null) delete costs.other;
    else costs.other = money(input.other, 'Other costs');
  }
  if (input.note !== undefined) {
    const note = String(input.note).trim().slice(0, 200);
    if (note) costs.note = note;
    else delete costs.note;
  }
  await Order.updateOne(
    { _id: order._id },
    Object.keys(costs).length ? { $set: { costs } } : { $unset: { costs: 1 } }
  );
  return { id: orderId, costs };
}

/** Default courier prices (per delivered parcel / per parcel sent back). */
export async function setCourierCosts(input: { delivered?: number; returned?: number }) {
  const s = await getSettings();
  const next = {
    delivered: input.delivered !== undefined ? money(input.delivered, 'Delivered parcel') : (s.courierCosts?.delivered ?? 0),
    returned: input.returned !== undefined ? money(input.returned, 'Returned parcel') : (s.courierCosts?.returned ?? 0),
  };
  s.courierCosts = next;
  await s.save();
  return next;
}

/**
 * Set a product's cost price from the Profit page. Past order lines of this product that had no
 * cost get it too, so their profit can be counted.
 */
export async function setProductCost(
  productId: string,
  input: { costPrice?: number | null; delivery?: number | null; other?: number | null },
  applyToPastOrders: boolean
) {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, 'Product not found');
  const product = await Product.findById(productId).select('+unitCosts').lean<{ unitCosts?: { delivery?: number; other?: number } }>();
  if (!product) throw new ApiError(404, 'Product not found');
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, 1> = {};
  let cost: number | undefined;
  if (input.costPrice !== undefined) {
    if (input.costPrice === null) $unset.costPrice = 1;
    else $set.costPrice = cost = money(input.costPrice, 'Bought for');
  }
  if (input.delivery !== undefined || input.other !== undefined) {
    const u = { ...(product.unitCosts ?? {}) };
    for (const key of ['delivery', 'other'] as const) {
      const v = input[key];
      if (v === undefined) continue;
      if (v === null) delete u[key];
      else u[key] = money(v, key === 'delivery' ? 'Delivery' : 'Other costs');
    }
    if (Object.keys(u).length) $set.unitCosts = u;
    else $unset.unitCosts = 1;
  }
  const update: Record<string, unknown> = {};
  if (Object.keys($set).length) update.$set = $set;
  if (Object.keys($unset).length) update.$unset = $unset;
  if (Object.keys(update).length) await Product.updateOne({ _id: productId }, update);

  let ordersUpdated = 0;
  if (applyToPastOrders && cost !== undefined) {
    const id = new mongoose.Types.ObjectId(productId);
    const r = await Order.updateMany(
      { items: { $elemMatch: { product: id, unitCost: { $exists: false } } } },
      { $set: { 'items.$[line].unitCost': cost } },
      { arrayFilters: [{ 'line.product': id, 'line.unitCost': { $exists: false } }] }
    );
    ordersUpdated = r.modifiedCount;
  }
  return { productId, ordersUpdated };
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Product costs sheet: every product with its selling price, what it cost you and the profit
 * left on one sale (price − bought for − delivery − other), with or without orders.
 */
export async function productCostSheet(query: { q?: string; category?: string; missing?: boolean; page?: number; limit?: number }) {
  const limit = Math.min(100, Math.max(1, query.limit || 50));
  const page = Math.max(1, query.page || 1);
  const filter: Record<string, unknown> = {};
  const q = query.q?.trim();
  if (q) filter.$or = [{ name: new RegExp(escapeRegex(q), 'i') }, { sku: new RegExp(escapeRegex(q), 'i') }];
  if (query.category && mongoose.Types.ObjectId.isValid(query.category)) filter.category = query.category;
  if (query.missing) filter.costPrice = { $exists: false };
  const [docs, total, missing, courier] = await Promise.all([
    Product.find(filter)
      .select('+costPrice +unitCosts name sku slug price stock isActive images category')
      .populate('category', 'name')
      .sort({ isActive: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<
        {
          _id: unknown;
          name: string;
          sku?: string;
          slug: string;
          price: number;
          stock: number;
          isActive: boolean;
          costPrice?: number;
          unitCosts?: { delivery?: number; other?: number };
          images?: { url: string; isPrimary?: boolean }[];
          category?: { name?: string } | null;
        }[]
      >(),
    Product.countDocuments(filter),
    Product.countDocuments({ costPrice: { $exists: false } }),
    courierCosts(),
  ]);
  return {
    courierCosts: courier,
    missingCount: missing,
    page,
    limit,
    total,
    items: docs.map((p) => ({
      productId: String(p._id),
      name: p.name,
      sku: p.sku,
      slug: p.slug,
      category: p.category?.name ?? '',
      image: (p.images?.find((i) => i.isPrimary) || p.images?.[0])?.url,
      isActive: p.isActive,
      stock: p.stock,
      price: p.price,
      costPrice: typeof p.costPrice === 'number' ? p.costPrice : null,
      delivery: typeof p.unitCosts?.delivery === 'number' ? p.unitCosts.delivery : null,
      other: typeof p.unitCosts?.other === 'number' ? p.unitCosts.other : null,
    })),
  };
}

/** "YYYY-MM-DD" → noon UTC of that day (stays on the same day in Morocco time). */
function dayToDate(day: unknown) {
  const s = String(day ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new ApiError(400, 'Pick a date');
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, 'Pick a date');
  return d;
}

export async function addExpense(
  input: { label: string; category?: string; amount: number; day: string; note?: string },
  userId?: string
) {
  const label = String(input.label ?? '').trim().slice(0, 120);
  if (!label) throw new ApiError(400, 'Say what the expense is');
  const amount = money(input.amount, 'Amount');
  if (!(amount > 0)) throw new ApiError(400, 'Amount: enter more than 0');
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(String(input.category))
    ? (input.category as ExpenseCategory)
    : 'other';
  const e = await Expense.create({
    label,
    category,
    amount,
    date: dayToDate(input.day),
    note: input.note ? String(input.note).trim().slice(0, 300) : undefined,
    by: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : undefined,
  });
  return { id: String(e._id) };
}

export async function deleteExpense(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, 'Expense not found');
  const r = await Expense.deleteOne({ _id: id });
  if (!r.deletedCount) throw new ApiError(404, 'Expense not found');
}
