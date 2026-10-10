import mongoose, { Types } from 'mongoose';
import { Order, type OrderStatus } from '../models/Order';
import { Product } from '../models/Product';
import { DEFAULT_SEGMENT_SETTINGS, getSettings, type ICustomerSegmentSettings } from '../models/Settings';
import { User } from '../models/User';
import { ApiError } from '../utils/ApiError';
import { roundMoney } from '../utils/deposit';

/**
 * Customer reporting. Every figure is derived from order records (never stored totals):
 *
 * - Completed sale  = delivered order that is not fully refunded. Cancelled orders never count.
 * - Gross sales     = Σ list price × qty of completed orders (before wholesale discounts).
 * - Net sales       = gross sales − wholesale discounts − coupon discounts − refunds.
 *                     Shipping and tax are excluded (product revenue only).
 * - COGS            = Σ unit cost × qty recorded on each completed order line.
 * - Gross profit    = net sales − COGS; null when any completed order lacks cost data.
 * - Amount paid     = Σ paid per order (total once delivered, else a received deposit) − refunds.
 * - To collect      = open orders' total − deposit already received (deposits counted once).
 */

const OPEN: OrderStatus[] = ['pending', 'confirmed', 'shipped'];
// Whole order plus the staff-only line cost. (Listing "items" and "+items.unitCost" together
// would be a MongoDB path collision, so only the opt-in is given.)
const ORDER_FIELDS = '+items.unitCost';

type LeanOrder = {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  orderNumber: string;
  items: { product: Types.ObjectId; name: string; price: number; qty: number; listPrice?: number; unitCost?: number }[];
  pricing: { subtotal: number; discount: number; shipping: number; tax: number; total: number; wholesaleDiscount?: number };
  orderStatus: OrderStatus;
  paymentStatus: string;
  paymentMethod?: string;
  deposit?: { amount: number; status: 'pending' | 'received'; source?: string; receivedAt?: Date } | null;
  refunds?: { amount: number; reason: string; itemsReturned?: boolean; at: Date }[];
  channel?: 'retail' | 'wholesale';
  wholesaleTier?: { id: string; name: string; discountPercent: number };
  coupon?: { code?: string };
  createdAt: Date;
  timeline?: { status: OrderStatus; note?: string; at: Date }[];
};

interface SalesBlock {
  orders: number;
  completedOrders: number;
  grossSales: number;
  wholesaleDiscounts: number;
  couponDiscounts: number;
  refunds: number;
  netSales: number;
  cogs: number;
  ordersMissingCost: number;
  grossProfit: number | null;
  margin: number | null;
  averageOrderValue: number | null;
  profitPerOrder: number | null;
}

export interface CustomerMetrics {
  orders: { total: number; completed: number; open: number; cancelled: number; refunded: number; partiallyRefunded: number };
  sales: SalesBlock & { totalOrderValue: number; completedOrderValue: number; shippingCollected: number };
  channels: { retail: SalesBlock; wholesale: SalesBlock };
  payments: {
    totalPaid: number;
    depositsReceived: number;
    depositsAwaiting: number;
    dueOnDelivery: number;
    toCollect: number;
    refunds: number;
    codOrders: number;
    methods: string[];
  };
  dates: { firstOrder: Date | null; lastOrder: Date | null; lastCompleted: Date | null };
  /** False when profit figures were removed because the viewer lacks the "reports" permission. */
  profitVisible: boolean;
}

const sum = (values: number[]) => roundMoney(values.reduce((a, b) => a + b, 0));
const refundTotal = (o: LeanOrder) => (o.refunds || []).reduce((a, r) => a + r.amount, 0);

function emptySales(): SalesBlock {
  return {
    orders: 0, completedOrders: 0, grossSales: 0, wholesaleDiscounts: 0, couponDiscounts: 0, refunds: 0,
    netSales: 0, cogs: 0, ordersMissingCost: 0, grossProfit: 0, margin: null, averageOrderValue: null, profitPerOrder: null,
  };
}

function orderState(o: LeanOrder) {
  const refunded = refundTotal(o);
  const fullyRefunded = o.orderStatus === 'delivered' && refunded >= o.pricing.total - 0.005;
  return {
    refunded,
    fullyRefunded,
    completed: o.orderStatus === 'delivered' && !fullyRefunded,
    open: OPEN.includes(o.orderStatus),
    cancelled: o.orderStatus === 'cancelled',
  };
}

function addSale(block: SalesBlock, o: LeanOrder, refunded: number) {
  const gross = o.items.reduce((a, i) => a + (i.listPrice ?? i.price) * i.qty, 0);
  const charged = o.items.reduce((a, i) => a + i.price * i.qty, 0);
  block.completedOrders += 1;
  block.grossSales += gross;
  block.wholesaleDiscounts += gross - charged;
  block.couponDiscounts += o.pricing.discount || 0;
  block.refunds += refunded;
  if (o.items.every((i) => typeof i.unitCost === 'number')) {
    block.cogs += o.items.reduce((a, i) => a + (i.unitCost as number) * i.qty, 0);
  } else {
    block.ordersMissingCost += 1;
  }
}

function finishSales(block: SalesBlock) {
  for (const key of ['grossSales', 'wholesaleDiscounts', 'couponDiscounts', 'refunds', 'cogs'] as const) {
    block[key] = roundMoney(block[key]);
  }
  block.netSales = roundMoney(block.grossSales - block.wholesaleDiscounts - block.couponDiscounts - block.refunds);
  block.grossProfit = block.ordersMissingCost > 0 ? null : roundMoney(block.netSales - block.cogs);
  block.margin = block.grossProfit !== null && block.netSales > 0 ? roundMoney((block.grossProfit / block.netSales) * 100) : null;
  block.averageOrderValue = block.completedOrders ? roundMoney(block.netSales / block.completedOrders) : null;
  block.profitPerOrder = block.grossProfit !== null && block.completedOrders ? roundMoney(block.grossProfit / block.completedOrders) : null;
  return block;
}

/** All metrics for a set of orders (one customer, or everyone, for any period). */
export function computeMetrics(orders: LeanOrder[]): CustomerMetrics {
  const sales = emptySales();
  const channels = { retail: emptySales(), wholesale: emptySales() };
  const counts = { total: orders.length, completed: 0, open: 0, cancelled: 0, refunded: 0, partiallyRefunded: 0 };
  let totalOrderValue = 0;
  let completedOrderValue = 0;
  let shippingCollected = 0;
  const pay = { paid: 0, depositsReceived: 0, depositsAwaiting: 0, toCollect: 0, refunds: 0, cod: 0, usedDeposit: false };
  let firstOrder: Date | null = null;
  let lastOrder: Date | null = null;
  let lastCompleted: Date | null = null;

  for (const o of orders) {
    const st = orderState(o);
    const channel = channels[o.channel === 'wholesale' ? 'wholesale' : 'retail'];
    sales.orders += 1;
    channel.orders += 1;
    if (!firstOrder || o.createdAt < firstOrder) firstOrder = o.createdAt;
    if (!lastOrder || o.createdAt > lastOrder) lastOrder = o.createdAt;
    if ((o.paymentMethod || 'cod') === 'cod') pay.cod += 1;

    const depositReceived = o.deposit?.status === 'received' ? o.deposit.amount : 0;
    if (depositReceived) {
      pay.depositsReceived += depositReceived;
      pay.usedDeposit = true;
    }
    const paidOnOrder = o.orderStatus === 'delivered' ? o.pricing.total : depositReceived;
    pay.paid += paidOnOrder - st.refunded;
    pay.refunds += st.refunded;

    if (st.cancelled) counts.cancelled += 1;
    else totalOrderValue += o.pricing.total;

    if (st.open) {
      counts.open += 1;
      pay.toCollect += o.pricing.total - depositReceived;
      if (o.deposit?.status === 'pending') pay.depositsAwaiting += o.deposit.amount;
    }
    if (st.fullyRefunded) counts.refunded += 1;
    else if (st.refunded > 0 && o.orderStatus === 'delivered') counts.partiallyRefunded += 1;

    if (st.completed) {
      counts.completed += 1;
      completedOrderValue += o.pricing.total;
      shippingCollected += o.pricing.shipping || 0;
      if (!lastCompleted || o.createdAt > lastCompleted) lastCompleted = o.createdAt;
      addSale(sales, o, st.refunded);
      addSale(channel, o, st.refunded);
    }
  }

  finishSales(sales);
  finishSales(channels.retail);
  finishSales(channels.wholesale);

  return {
    orders: counts,
    sales: {
      ...sales,
      totalOrderValue: roundMoney(totalOrderValue),
      completedOrderValue: roundMoney(completedOrderValue),
      shippingCollected: roundMoney(shippingCollected),
    },
    channels,
    payments: {
      totalPaid: roundMoney(pay.paid),
      depositsReceived: roundMoney(pay.depositsReceived),
      depositsAwaiting: roundMoney(pay.depositsAwaiting),
      dueOnDelivery: roundMoney(pay.toCollect - pay.depositsAwaiting),
      toCollect: roundMoney(pay.toCollect),
      refunds: roundMoney(pay.refunds),
      codOrders: pay.cod,
      methods: [pay.cod ? 'Cash on delivery' : '', pay.usedDeposit ? 'Advance deposit' : ''].filter(Boolean),
    },
    dates: { firstOrder, lastOrder, lastCompleted },
    profitVisible: true,
  };
}

/** Removes cost and profit figures for staff without the "reports" permission. */
function redactProfit(m: CustomerMetrics): CustomerMetrics {
  const strip = (b: SalesBlock): SalesBlock => ({ ...b, cogs: 0, ordersMissingCost: 0, grossProfit: null, margin: null, profitPerOrder: null });
  return {
    ...m,
    sales: { ...m.sales, ...strip(m.sales) },
    channels: { retail: strip(m.channels.retail), wholesale: strip(m.channels.wholesale) },
    profitVisible: false,
  };
}

function inPeriod(o: LeanOrder, from?: Date, to?: Date) {
  return (!from || o.createdAt >= from) && (!to || o.createdAt <= to);
}

export function shortCustomerId(id: unknown) {
  return `C-${String(id).slice(-6).toUpperCase()}`;
}

type CustomerLean = {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  customerType?: 'retail' | 'wholesale' | 'business';
  wholesale?: { status?: string; tierId?: string };
  business?: { companyName?: string };
  isActive: boolean;
  emailVerified?: boolean;
  isGuest?: boolean;
  createdAt: Date;
};

export type AccountStatus = 'active' | 'disabled' | 'unverified' | 'wholesale-pending';

function accountStatus(u: CustomerLean): AccountStatus {
  if (!u.isActive) return 'disabled';
  if (u.wholesale?.status === 'pending') return 'wholesale-pending';
  if (u.emailVerified === false) return 'unverified';
  return 'active';
}

export const SEGMENTS = ['new', 'repeat', 'high-spend', 'high-profit', 'inactive', 'wholesale', 'wholesale-pending', 'outstanding'] as const;
export type SegmentKey = (typeof SEGMENTS)[number];

function segmentsFor(u: CustomerLean, m: CustomerMetrics, cfg: ICustomerSegmentSettings, now: number) {
  const day = 86_400_000;
  const out: SegmentKey[] = [];
  if (now - u.createdAt.getTime() <= cfg.newDays * day) out.push('new');
  if (m.orders.completed >= 2) out.push('repeat');
  if (m.sales.netSales >= cfg.highSpendMin && cfg.highSpendMin > 0) out.push('high-spend');
  if (m.sales.grossProfit !== null && cfg.highProfitMin > 0 && m.sales.grossProfit >= cfg.highProfitMin) out.push('high-profit');
  const lastActive = m.dates.lastOrder?.getTime() ?? u.createdAt.getTime();
  if (now - lastActive > cfg.inactiveDays * day) out.push('inactive');
  if (u.wholesale?.status === 'approved' && u.customerType !== 'retail') out.push('wholesale');
  if (u.wholesale?.status === 'pending') out.push('wholesale-pending');
  if (m.payments.toCollect > 0) out.push('outstanding');
  return out;
}

export interface CustomerListQuery {
  page?: number;
  limit?: number;
  q?: string;
  type?: string;
  status?: string;
  registeredFrom?: Date;
  registeredTo?: Date;
  from?: Date;
  to?: Date;
  activity?: 'ordered' | 'never' | 'active' | 'inactive';
  minOrders?: number;
  maxOrders?: number;
  minNet?: number;
  maxNet?: number;
  minProfit?: number;
  segment?: string;
  sort?: 'spent' | 'net' | 'profit' | 'orders' | 'lastOrder' | 'registered' | 'name';
  dir?: 'asc' | 'desc';
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadCustomers(query: CustomerListQuery) {
  const filter: Record<string, unknown> = { role: 'customer' };
  const and: Record<string, unknown>[] = [];
  const q = query.q?.trim();
  if (q) {
    const rx = new RegExp(escapeRegex(q.replace(/^C-/i, '')), 'i');
    const or: Record<string, unknown>[] = [{ name: rx }, { email: rx }, { phone: rx }, { 'business.companyName': rx }];
    const idPart = q.replace(/^C-/i, '').toLowerCase();
    if (/^[a-f0-9]{4,24}$/.test(idPart)) {
      or.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: `${idPart}$` } } });
    }
    and.push({ $or: or });
  }
  if (query.type && ['retail', 'wholesale', 'business'].includes(query.type)) {
    and.push(query.type === 'retail' ? { customerType: { $in: ['retail', null] } } : { customerType: query.type });
  }
  if (query.status === 'active') and.push({ isActive: true, emailVerified: { $ne: false } });
  if (query.status === 'disabled') and.push({ isActive: false });
  if (query.status === 'unverified') and.push({ emailVerified: false });
  if (query.status === 'wholesale-pending') and.push({ 'wholesale.status': 'pending' });
  if (query.registeredFrom || query.registeredTo) {
    and.push({
      createdAt: {
        ...(query.registeredFrom ? { $gte: query.registeredFrom } : {}),
        ...(query.registeredTo ? { $lte: query.registeredTo } : {}),
      },
    });
  }
  if (and.length) filter.$and = and;
  return User.find(filter)
    .select('name email phone customerType wholesale business isActive emailVerified isGuest createdAt')
    .lean<CustomerLean[]>();
}

async function ordersByUser(userIds: Types.ObjectId[]) {
  const orders = await Order.find(userIds.length ? { user: { $in: userIds } } : { _id: null })
    .select(ORDER_FIELDS)
    .lean<LeanOrder[]>();
  const map = new Map<string, LeanOrder[]>();
  for (const o of orders) {
    const key = String(o.user);
    const list = map.get(key);
    if (list) list.push(o);
    else map.set(key, [o]);
  }
  return map;
}

function tierName(u: CustomerLean, tiers: { id: string; name: string }[]) {
  return u.wholesale?.status === 'approved' ? tiers.find((t) => t.id === u.wholesale?.tierId)?.name : undefined;
}

/** Saved-segment filters (stored as plain values) → typed list filters. */
function savedFilters(filters: Record<string, string | number>): Partial<CustomerListQuery> {
  const day = (v: unknown, end = false) =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${end ? '23:59:59.999' : '00:00:00.000'}Z`) : undefined;
  const out: Record<string, unknown> = { ...filters };
  for (const key of ['registeredFrom', 'from'] as const) if (key in filters) out[key] = day(filters[key]);
  for (const key of ['registeredTo', 'to'] as const) if (key in filters) out[key] = day(filters[key], true);
  return out as Partial<CustomerListQuery>;
}

/** Customers with their metrics, filtered, sorted and paginated. Metrics follow the optional order period. */
export async function listCustomerOverview(query: CustomerListQuery, canSeeProfit: boolean) {
  const settings = await getSettings();
  const cfg = { ...DEFAULT_SEGMENT_SETTINGS, ...(settings.customerSegments || {}) };
  const tiers = settings.wholesaleTiers || [];
  // A saved custom segment is just a stored set of filters, applied to every step below
  const saved = cfg.saved.find((s) => s.id === query.segment);
  const f: CustomerListQuery = saved ? { ...query, ...savedFilters(saved.filters), segment: undefined } : query;
  const users = await loadCustomers(f);
  const orders = await ordersByUser(users.map((u) => u._id));
  const now = Date.now();
  const periodSet = Boolean(query.from || query.to);
  const num = (v: unknown) => (v === undefined || v === '' || v === null ? undefined : Number(v));

  let rows = users.map((u) => {
    const all = orders.get(String(u._id)) || [];
    const lifetime = computeMetrics(all);
    const metrics = periodSet ? computeMetrics(all.filter((o) => inPeriod(o, query.from, query.to))) : lifetime;
    return {
      _id: u._id,
      customerId: shortCustomerId(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone,
      companyName: u.business?.companyName,
      customerType: u.customerType || 'retail',
      status: accountStatus(u),
      wholesaleStatus: u.wholesale?.status || 'none',
      tierName: tierName(u, tiers),
      isGuest: Boolean(u.isGuest),
      registeredAt: u.createdAt,
      segments: segmentsFor(u, lifetime, cfg, now),
      metrics: canSeeProfit ? metrics : redactProfit(metrics),
    };
  });

  const segment = (f.segment as string | undefined) || undefined;
  if (segment && (SEGMENTS as readonly string[]).includes(segment)) {
    if (segment === 'high-profit' && !canSeeProfit) rows = [];
    else rows = rows.filter((r) => r.segments.includes(segment as SegmentKey));
  }
  if (f.activity === 'ordered') rows = rows.filter((r) => r.metrics.orders.total > 0);
  if (f.activity === 'never') rows = rows.filter((r) => r.metrics.orders.total === 0);
  if (f.activity === 'active') rows = rows.filter((r) => !r.segments.includes('inactive'));
  if (f.activity === 'inactive') rows = rows.filter((r) => r.segments.includes('inactive'));
  const minOrders = num(f.minOrders), maxOrders = num(f.maxOrders), minNet = num(f.minNet), maxNet = num(f.maxNet), minProfit = num(f.minProfit);
  if (minOrders !== undefined) rows = rows.filter((r) => r.metrics.orders.completed >= minOrders);
  if (maxOrders !== undefined) rows = rows.filter((r) => r.metrics.orders.completed <= maxOrders);
  if (minNet !== undefined) rows = rows.filter((r) => r.metrics.sales.netSales >= minNet);
  if (maxNet !== undefined) rows = rows.filter((r) => r.metrics.sales.netSales <= maxNet);
  if (minProfit !== undefined && canSeeProfit) {
    rows = rows.filter((r) => r.metrics.sales.grossProfit !== null && r.metrics.sales.grossProfit >= minProfit);
  }

  const sort = query.sort === 'profit' && !canSeeProfit ? 'net' : query.sort || 'registered';
  const dir = query.dir === 'asc' ? 1 : -1;
  const key = (r: (typeof rows)[number]): number | string => {
    switch (sort) {
      case 'spent': return r.metrics.payments.totalPaid;
      case 'net': return r.metrics.sales.netSales;
      case 'profit': return r.metrics.sales.grossProfit ?? -Infinity;
      case 'orders': return r.metrics.orders.completed;
      case 'lastOrder': return r.metrics.dates.lastOrder?.getTime() ?? 0;
      case 'name': return r.name.toLowerCase();
      default: return r.registeredAt.getTime();
    }
  };
  rows.sort((a, b) => {
    const ka = key(a), kb = key(b);
    return (ka < kb ? -1 : ka > kb ? 1 : 0) * dir;
  });

  const limit = Math.min(Math.max(query.limit || 20, 1), 100);
  const page = Math.max(query.page || 1, 1);
  return { items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit, all: rows };
}

/** Dashboard cards: current account counts plus selected-period and lifetime sales. */
export async function customerSummary(from: Date | undefined, to: Date | undefined, canSeeProfit: boolean) {
  const settings = await getSettings();
  const segmentSettings = { ...DEFAULT_SEGMENT_SETTINGS, ...(settings.customerSegments || {}) };
  const users = await User.find({ role: 'customer' })
    .select('customerType wholesale isActive emailVerified createdAt')
    .lean<CustomerLean[]>();
  const orders = await Order.find({ user: { $in: users.map((u) => u._id) } }).select(ORDER_FIELDS).lean<LeanOrder[]>();
  const lifetime = computeMetrics(orders);
  const period = from || to ? computeMetrics(orders.filter((o) => inPeriod(o, from, to))) : null;
  const pick = (m: CustomerMetrics) => {
    const v = canSeeProfit ? m : redactProfit(m);
    return {
      netSales: v.sales.netSales,
      grossProfit: v.sales.grossProfit,
      ordersMissingCost: v.sales.ordersMissingCost,
      averageOrderValue: v.sales.averageOrderValue,
      completedOrders: v.orders.completed,
      toCollect: v.payments.toCollect,
      profitVisible: v.profitVisible,
    };
  };
  return {
    counts: {
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      retail: users.filter((u) => !u.customerType || u.customerType === 'retail').length,
      wholesaleApproved: users.filter((u) => u.wholesale?.status === 'approved' && u.customerType !== 'retail').length,
      wholesalePending: users.filter((u) => u.wholesale?.status === 'pending').length,
      newInPeriod: from || to ? users.filter((u) => (!from || u.createdAt >= from) && (!to || u.createdAt <= to)).length : null,
    },
    lifetime: pick(lifetime),
    period: period ? pick(period) : null,
    segmentSettings,
    wholesaleTiers: settings.wholesaleTiers || [],
  };
}

/** Everything on the customer profile page. */
export async function customerProfile(
  id: string,
  canSeeProfit: boolean,
  from?: Date,
  to?: Date
): Promise<Record<string, unknown>> {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, 'Customer not found');
  const user = await User.findOne({ _id: id, role: 'customer' })
    .select('+adminNotes +activity')
    .populate('activity.by', 'name')
    .populate('wholesale.reviewedBy', 'name')
    .lean();
  if (!user) throw new ApiError(404, 'Customer not found');

  const settings = await getSettings();
  const cfg = { ...DEFAULT_SEGMENT_SETTINGS, ...(settings.customerSegments || {}) };
  const tiers = settings.wholesaleTiers || [];
  const orders = (await Order.find({ user: user._id }).select(ORDER_FIELDS).sort({ createdAt: -1 }).lean<LeanOrder[]>()) || [];

  const lifetimeRaw = computeMetrics(orders);
  const periodRaw = from || to ? computeMetrics(orders.filter((o) => inPeriod(o, from, to))) : null;
  const view = (m: CustomerMetrics) => (canSeeProfit ? m : redactProfit(m));

  // Products and categories bought (cancelled orders excluded)
  const bought = new Map<string, { productId: string; name: string; qty: number; orders: number; spent: number }>();
  for (const o of orders) {
    if (o.orderStatus === 'cancelled') continue;
    for (const item of o.items) {
      const key = String(item.product);
      const row = bought.get(key) || { productId: key, name: item.name, qty: 0, orders: 0, spent: 0 };
      row.qty += item.qty;
      row.orders += 1;
      row.spent = roundMoney(row.spent + item.price * item.qty);
      bought.set(key, row);
    }
  }
  const productDocs = await Product.find({ _id: { $in: [...bought.keys()] } })
    .select('slug category')
    .populate('category', 'name')
    .lean<{ _id: Types.ObjectId; slug: string; category?: { name?: string } }[]>();
  const productInfo = new Map(productDocs.map((p) => [String(p._id), p]));
  const topProducts = [...bought.values()]
    .sort((a, b) => b.qty - a.qty || b.spent - a.spent)
    .slice(0, 8)
    .map((p) => ({ ...p, slug: productInfo.get(p.productId)?.slug }));
  const categoryTotals = new Map<string, { name: string; qty: number; spent: number }>();
  for (const p of bought.values()) {
    const name = productInfo.get(p.productId)?.category?.name || 'Other';
    const row = categoryTotals.get(name) || { name, qty: 0, spent: 0 };
    row.qty += p.qty;
    row.spent = roundMoney(row.spent + p.spent);
    categoryTotals.set(name, row);
  }

  // Chronological relationship history
  type Event = { at: Date; type: string; title: string; detail?: string; orderId?: string; orderNumber?: string };
  const events: Event[] = [{ at: user.createdAt, type: 'registered', title: 'Account created' }];
  for (const o of orders) {
    events.push({ at: o.createdAt, type: 'order', title: `Order #${o.orderNumber} placed`, detail: `${roundMoney(o.pricing.total)} DH · ${o.channel || 'retail'}`, orderId: String(o._id), orderNumber: o.orderNumber });
    for (const t of (o.timeline || []).slice(1)) {
      events.push({ at: t.at, type: 'order-update', title: `Order #${o.orderNumber}: ${t.status}`, detail: t.note, orderId: String(o._id), orderNumber: o.orderNumber });
    }
    if (o.deposit?.status === 'received' && o.deposit.receivedAt) {
      events.push({ at: o.deposit.receivedAt, type: 'payment', title: `Deposit received — order #${o.orderNumber}`, detail: `${o.deposit.amount} DH`, orderId: String(o._id), orderNumber: o.orderNumber });
    }
  }
  for (const a of (user.activity || []) as { type: string; note: string; at: Date; by?: { name?: string } }[]) {
    events.push({ at: a.at, type: a.type, title: a.note, detail: a.by?.name ? `by ${a.by.name}` : undefined });
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());

  const lastActive = lifetimeRaw.dates.lastOrder ?? user.createdAt;
  const daysInactive = Math.floor((Date.now() - new Date(lastActive).getTime()) / 86_400_000);

  return {
    customer: {
      ...user,
      customerId: shortCustomerId(user._id),
      status: accountStatus(user as unknown as CustomerLean),
      tier: tiers.find((t) => t.id === user.wholesale?.tierId) || null,
      segments: segmentsFor(user as unknown as CustomerLean, lifetimeRaw, cfg, Date.now()),
      daysInactive,
      inactive: daysInactive > cfg.inactiveDays,
      inactiveDays: cfg.inactiveDays,
    },
    lifetime: view(lifetimeRaw),
    period: periodRaw ? view(periodRaw) : null,
    orders: orders.map((o) => {
      const st = orderState(o);
      return {
        _id: o._id,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        orderStatus: o.orderStatus,
        paymentStatus: o.paymentStatus,
        channel: o.channel || 'retail',
        tierName: o.wholesaleTier?.name,
        items: o.items.reduce((a, i) => a + i.qty, 0),
        total: o.pricing.total,
        discount: roundMoney((o.pricing.discount || 0) + (o.pricing.wholesaleDiscount || 0)),
        deposit: o.deposit ? { amount: o.deposit.amount, status: o.deposit.status } : null,
        refunded: roundMoney(st.refunded),
        fullyRefunded: st.fullyRefunded,
        completed: st.completed,
      };
    }),
    refunds: orders.flatMap((o) =>
      (o.refunds || []).map((r) => ({ ...r, orderId: o._id, orderNumber: o.orderNumber }))
    ),
    topProducts,
    categories: [...categoryTotals.values()].sort((a, b) => b.spent - a.spent),
    timeline: events.slice(0, 200),
    wholesaleTiers: tiers,
  };
}

/** CSV of the filtered customer list (one row per customer). */
export async function exportCustomersCsv(query: CustomerListQuery, canSeeProfit: boolean) {
  const { all } = await listCustomerOverview({ ...query, page: 1, limit: 100 }, canSeeProfit);
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    // Quote, and neutralise spreadsheet formulas
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
  };
  const headers = [
    'Customer ID', 'Name', 'Email', 'Phone', 'Company', 'Type', 'Status', 'Wholesale tier', 'Registered',
    'Orders', 'Completed orders', 'Amount paid', 'Net sales', 'Avg order value', 'First order', 'Last order', 'To collect',
    ...(canSeeProfit ? ['Gross profit', 'Margin %'] : []),
  ];
  const lines = all.map((r) =>
    [
      r.customerId, r.name, r.email, r.phone, r.companyName, r.customerType, r.status, r.tierName, r.registeredAt,
      r.metrics.orders.total, r.metrics.orders.completed, r.metrics.payments.totalPaid, r.metrics.sales.netSales,
      r.metrics.sales.averageOrderValue, r.metrics.dates.firstOrder, r.metrics.dates.lastOrder, r.metrics.payments.toCollect,
      ...(canSeeProfit
        ? [r.metrics.sales.grossProfit ?? 'cost data needed', r.metrics.sales.margin ?? '']
        : []),
    ]
      .map(cell)
      .join(',')
  );
  return [headers.map(cell).join(','), ...lines].join('\r\n');
}
