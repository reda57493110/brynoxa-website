import { Order } from '../models/Order';
import { ORDER_STATUSES, deliveredExpr, deliveredFilter, placedFilter } from '../utils/orderStatus';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { User } from '../models/User';
import { roundMoney } from '../utils/deposit';
// Called inside functions only, so the two services can import each other
import { adjustmentsSince } from './profit.service';

/**
 * Dashboard sales analytics, same dating as Admin → Profit (profit.service):
 * - a sale is a delivered order (cash on delivery = paid on delivery);
 * - revenue = net sales = items charged − coupon discount (shipping excluded), on the day the
 *   order was placed; money given back after a delivery comes off on the day it is paid, and the
 *   cost of products that came back comes off the cost of sales on the day they came back;
 * - days are in the store's timezone (Morocco);
 * - cancelled orders never count.
 * Daily buckets are computed in MongoDB and the totals are summed from the same buckets, so the
 * chart and the totals always reconcile.
 */

export const STORE_TIMEZONE = 'Africa/Casablanca';
export const SALES_RANGES = [7, 14, 30, 90, 180, 365] as const;
export type SalesRange = (typeof SALES_RANGES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of an instant in the store timezone. */
export function localDay(at: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** The `count` calendar days ending today (store timezone), oldest first. */
export function dayKeys(count: number, endOffset = 0): string[] {
  const today = localDay(new Date());
  const [y, m, d] = today.split('-').map(Number);
  // Noon UTC keeps the date arithmetic clear of DST/offset edges
  const base = Date.UTC(y, m - 1, d, 12);
  return Array.from({ length: count }, (_, i) => new Date(base - (count - 1 - i + endOffset) * DAY_MS).toISOString().slice(0, 10));
}

type DayRow = {
  _id: string;
  orders: number;
  orderValue: number;
  completedOrders: number;
  revenue: number;
  cogs: number;
  missingCost: number;
};

/**
 * Per-day figures since `since`: orders by the day they were placed, then refunds and products
 * back after a delivery on their own day (Admin → Profit's adjustments).
 */
async function dailyRows(since: Date): Promise<DayRow[]> {
  const [placed, adjustments] = await Promise.all([placedRows(since), adjustmentsSince(Math.ceil((Date.now() - since.getTime()) / DAY_MS))]);
  const byDay = new Map(placed.map((r) => [r._id, { ...r }]));
  for (const a of adjustments) {
    if (a.type === 'write-off') continue;
    const row = byDay.get(a.day) ?? { _id: a.day, orders: 0, orderValue: 0, completedOrders: 0, revenue: 0, cogs: 0, missingCost: 0 };
    if (a.type === 'refund') row.revenue -= a.amount;
    else row.cogs -= a.amount;
    byDay.set(a.day, row);
  }
  return [...byDay.values()];
}

/** Per-day figures for every order placed since `since` (bucketed by local day). */
async function placedRows(since: Date): Promise<DayRow[]> {
  return Order.aggregate<DayRow>([
    { $match: { createdAt: { $gte: since }, ...placedFilter } },
    {
      $project: {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STORE_TIMEZONE } },
        delivered: deliveredExpr,
        total: '$pricing.total',
        discount: { $ifNull: ['$pricing.discount', 0] },
        charged: { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: ['$$i.price', '$$i.qty'] } } } },
        cogs: { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: [{ $ifNull: ['$$i.unitCost', 0] }, '$$i.qty'] } } } },
        missingCost: {
          $anyElementTrue: [{ $map: { input: '$items', as: 'i', in: { $eq: [{ $type: '$$i.unitCost' }, 'missing'] } } }],
        },
        refunded: { $sum: { $map: { input: { $ifNull: ['$refunds', []] }, as: 'r', in: '$$r.amount' } } },
      },
    },
    {
      $addFields: {
        completed: '$delivered',
      },
    },
    {
      $group: {
        _id: '$day',
        orders: { $sum: 1 },
        orderValue: { $sum: '$total' },
        completedOrders: { $sum: { $cond: ['$completed', 1, 0] } },
        revenue: { $sum: { $cond: ['$completed', { $subtract: ['$charged', '$discount'] }, 0] } },
        cogs: { $sum: { $cond: ['$completed', '$cogs', 0] } },
        missingCost: { $sum: { $cond: [{ $and: ['$completed', '$missingCost'] }, 1, 0] } },
      },
    },
  ]);
}

function totalsOf(rows: DayRow[]) {
  const t = rows.reduce(
    (a, r) => ({
      orders: a.orders + r.orders,
      orderValue: a.orderValue + r.orderValue,
      completedOrders: a.completedOrders + r.completedOrders,
      revenue: a.revenue + r.revenue,
      cogs: a.cogs + r.cogs,
      missingCost: a.missingCost + r.missingCost,
    }),
    { orders: 0, orderValue: 0, completedOrders: 0, revenue: 0, cogs: 0, missingCost: 0 }
  );
  const revenue = roundMoney(t.revenue);
  return {
    revenue,
    orders: t.orders,
    orderValue: roundMoney(t.orderValue),
    completedOrders: t.completedOrders,
    avgOrderValue: t.completedOrders ? roundMoney(revenue / t.completedOrders) : null,
    // Profit only when every sale has its cost recorded; never an estimate
    profit: t.missingCost > 0 ? null : roundMoney(revenue - t.cogs),
    salesMissingCost: t.missingCost,
  };
}

/** Best sellers of the period: units and revenue from completed sales (order lines, not stock). */
async function topProducts(since: Date, days: Set<string>, limit = 5) {
  const rows = await Order.aggregate<{ _id: unknown; name: string; units: number; revenue: number }>([
    { $match: { createdAt: { $gte: since }, ...deliveredFilter } },
    {
      $addFields: {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STORE_TIMEZONE } },
        refunded: { $sum: { $map: { input: { $ifNull: ['$refunds', []] }, as: 'r', in: '$$r.amount' } } },
      },
    },
    { $match: { day: { $in: [...days] }, $expr: { $lt: ['$refunded', { $subtract: ['$pricing.total', 0.005] }] } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.product',
        name: { $last: '$items.name' },
        units: { $sum: '$items.qty' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.qty'] } },
      },
    },
    { $sort: { units: -1, revenue: -1 } },
    { $limit: limit },
  ]);
  const products = await Product.find({ _id: { $in: rows.map((r) => r._id) } })
    .select('name slug images isActive')
    .lean<{ _id: unknown; name: string; slug: string; images?: { url: string; isPrimary?: boolean }[]; isActive: boolean }[]>();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return rows.map((r) => {
    const p = byId.get(String(r._id));
    return {
      productId: String(r._id),
      name: r.name,
      slug: p?.slug,
      image: (p?.images?.find((i) => i.isPrimary) || p?.images?.[0])?.url,
      exists: Boolean(p),
      units: r.units,
      revenue: roundMoney(r.revenue),
    };
  });
}

/** Daily series for the last `range` days (zero-filled), totals, previous-period comparison, best sellers. */
export async function salesAnalytics(range: SalesRange, canSeeProfit: boolean, bestLimit = 5) {
  const current = dayKeys(range);
  const previous = dayKeys(range, range);
  // A little extra margin for the timezone offset; buckets outside the two periods are ignored
  const since = new Date(Date.now() - (range * 2 + 2) * DAY_MS);
  const [rows, best] = await Promise.all([dailyRows(since), topProducts(since, new Set(current), bestLimit)]);
  const byDay = new Map(rows.map((r) => [r._id, r]));
  const empty = (day: string): DayRow => ({ _id: day, orders: 0, orderValue: 0, completedOrders: 0, revenue: 0, cogs: 0, missingCost: 0 });
  const currentRows = current.map((d) => byDay.get(d) ?? empty(d));
  const previousRows = previous.map((d) => byDay.get(d) ?? empty(d));

  const strip = <T extends { profit: number | null; salesMissingCost: number }>(t: T) =>
    canSeeProfit ? t : { ...t, profit: null, salesMissingCost: 0 };

  return {
    range,
    timezone: STORE_TIMEZONE,
    from: current[0],
    to: current[current.length - 1],
    series: currentRows.map((r) => ({
      date: r._id,
      revenue: roundMoney(r.revenue),
      sales: r.completedOrders,
      orders: r.orders,
      orderValue: roundMoney(r.orderValue),
    })),
    totals: strip(totalsOf(currentRows)),
    previous: { from: previous[0], to: previous[previous.length - 1], ...strip(totalsOf(previousRows)) },
    topProducts: best,
    profitVisible: canSeeProfit,
  };
}

// ---------------------------------------------------------------------------
// Full analytics report (Admin → Analytics)
// ---------------------------------------------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ReportFacet = {
  status: { _id: string; orders: number; value: number }[];
  channel: { _id: string; sales: number; revenue: number }[];
  cities: { _id: string; orders: number; value: number }[];
  weekday: { _id: number; orders: number; value: number }[];
  refunds: { _id: null; amount: number; orders: number }[];
  buyers: { _id: unknown }[];
  conditions: { _id: string; units: number; revenue: number }[];
  categories: { _id: unknown; units: number; revenue: number }[];
};

/**
 * Everything on the Analytics page for the last `range` days (store timezone): the sales series
 * and totals (salesAnalytics) plus breakdowns by order status, channel, city, weekday, condition
 * and category, refunds and customers. Same sale rules as the dashboard.
 */
export async function analyticsReport(range: SalesRange, canSeeProfit: boolean) {
  const sales = await salesAnalytics(range, canSeeProfit, 10);
  const days = dayKeys(range);
  const since = new Date(Date.now() - (range + 2) * DAY_MS);
  const dayExpr = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STORE_TIMEZONE } };
  const refundedExpr = { $sum: { $map: { input: { $ifNull: ['$refunds', []] }, as: 'r', in: '$$r.amount' } } };
  // A sale = delivered, as in the totals (money given back later is counted on its own day)
  const completedExpr = deliveredExpr;
  const notCancelled = placedFilter;
  const completedOnly = { $expr: completedExpr };
  const lineRevenue = { $multiply: ['$items.price', '$items.qty'] };
  const chargedExpr = { $sum: { $map: { input: '$items', as: 'i', in: { $multiply: ['$$i.price', '$$i.qty'] } } } };

  const [facet] = await Order.aggregate<ReportFacet>([
    { $match: { createdAt: { $gte: since } } },
    { $addFields: { day: dayExpr, refunded: refundedExpr } },
    { $match: { day: { $in: days } } },
    {
      $facet: {
        status: [{ $group: { _id: '$orderStatus', orders: { $sum: 1 }, value: { $sum: '$pricing.total' } } }],
        channel: [
          { $match: completedOnly },
          {
            $group: {
              _id: { $ifNull: ['$channel', 'retail'] },
              sales: { $sum: 1 },
              revenue: { $sum: { $subtract: [chargedExpr, { $ifNull: ['$pricing.discount', 0] }] } },
            },
          },
        ],
        cities: [
          { $match: notCancelled },
          {
            $group: {
              _id: { $toLower: { $trim: { input: { $ifNull: ['$shippingAddress.city', ''] } } } },
              orders: { $sum: 1 },
              value: { $sum: '$pricing.total' },
            },
          },
          { $match: { _id: { $ne: '' } } },
          { $sort: { orders: -1, value: -1 } },
          { $limit: 8 },
        ],
        weekday: [
          { $match: notCancelled },
          {
            $group: {
              _id: { $dayOfWeek: { date: '$createdAt', timezone: STORE_TIMEZONE } },
              orders: { $sum: 1 },
              value: { $sum: '$pricing.total' },
            },
          },
        ],
        refunds: [{ $match: { refunded: { $gt: 0 } } }, { $group: { _id: null, amount: { $sum: '$refunded' }, orders: { $sum: 1 } } }],
        buyers: [{ $match: notCancelled }, { $group: { _id: '$user' } }],
        conditions: [
          { $match: completedOnly },
          { $unwind: '$items' },
          { $group: { _id: { $ifNull: ['$items.condition', 'new'] }, units: { $sum: '$items.qty' }, revenue: { $sum: lineRevenue } } },
        ],
        categories: [
          { $match: completedOnly },
          { $unwind: '$items' },
          {
            $lookup: {
              from: 'products',
              localField: 'items.product',
              foreignField: '_id',
              as: 'p',
              pipeline: [{ $project: { category: 1 } }],
            },
          },
          { $group: { _id: { $first: '$p.category' }, units: { $sum: '$items.qty' }, revenue: { $sum: lineRevenue } } },
          { $sort: { revenue: -1 } },
        ],
      },
    },
  ]);

  const catIds = (facet?.categories ?? []).map((c) => c._id).filter(Boolean);
  const cats = await Category.find({ _id: { $in: catIds } }).select('name').lean<{ _id: unknown; name: string }[]>();
  const catName = new Map(cats.map((c) => [String(c._id), c.name]));

  // Customers: buyers who had ordered before the period vs first-timers; new sign-ups
  const buyerIds = (facet?.buyers ?? []).map((b) => b._id).filter(Boolean);
  const periodStart = new Date(Date.now() - range * DAY_MS);
  const [returningIds, guestBuyers, newAccounts, newAccountsPrev] = await Promise.all([
    buyerIds.length
      ? Order.distinct('user', { user: { $in: buyerIds }, createdAt: { $lt: periodStart }, ...placedFilter })
      : Promise.resolve([]),
    buyerIds.length ? User.countDocuments({ _id: { $in: buyerIds }, isGuest: true }) : Promise.resolve(0),
    User.countDocuments({ role: 'customer', isGuest: { $ne: true }, createdAt: { $gte: periodStart } }),
    User.countDocuments({
      role: 'customer',
      isGuest: { $ne: true },
      createdAt: { $gte: new Date(periodStart.getTime() - range * DAY_MS), $lt: periodStart },
    }),
  ]);

  const statusRows = facet?.status ?? [];
  const placedAll = statusRows.reduce((a, s) => a + s.orders, 0);
  const cancelled = statusRows.find((s) => s._id === 'cancelled')?.orders ?? 0;

  return {
    ...sales,
    status: ORDER_STATUSES.map((s) => {
      const row = statusRows.find((r) => r._id === s);
      return { status: s, orders: row?.orders ?? 0, value: roundMoney(row?.value ?? 0) };
    }),
    cancellationRate: placedAll ? roundMoney((cancelled / placedAll) * 100) : null,
    channels: (facet?.channel ?? []).map((c) => ({ channel: c._id, sales: c.sales, revenue: roundMoney(c.revenue) })),
    cities: (facet?.cities ?? []).map((c) => ({ city: c._id, orders: c.orders, value: roundMoney(c.value) })),
    weekdays: WEEKDAYS.map((label, i) => {
      const row = (facet?.weekday ?? []).find((w) => w._id === i + 1);
      return { day: label, orders: row?.orders ?? 0, value: roundMoney(row?.value ?? 0) };
    }),
    refunds: { amount: roundMoney(facet?.refunds?.[0]?.amount ?? 0), orders: facet?.refunds?.[0]?.orders ?? 0 },
    conditions: (facet?.conditions ?? []).map((c) => ({ condition: c._id, units: c.units, revenue: roundMoney(c.revenue) })),
    categories: (facet?.categories ?? []).map((c) => ({
      categoryId: c._id ? String(c._id) : null,
      name: c._id ? (catName.get(String(c._id)) ?? 'Deleted category') : 'Deleted products',
      units: c.units,
      revenue: roundMoney(c.revenue),
    })),
    customers: {
      buyers: buyerIds.length,
      returning: returningIds.length,
      firstTime: buyerIds.length - returningIds.length,
      guests: guestBuyers,
      newAccounts,
      newAccountsPrev,
    },
  };
}
