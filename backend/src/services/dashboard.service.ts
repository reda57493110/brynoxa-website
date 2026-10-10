import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { roundMoney } from '../utils/deposit';

/**
 * Dashboard sales analytics. Same rules as the Customers reports (customerAnalytics.service):
 * - a sale is a delivered order that is not fully refunded (cash on delivery = paid on delivery);
 * - revenue = net sales = items charged − coupon discount − refunds (shipping excluded);
 * - orders are dated by when they were placed, in the store's timezone (Morocco);
 * - cancelled orders never count.
 * Daily buckets are computed in MongoDB and the totals are summed from the same buckets, so the
 * chart and the totals always reconcile.
 */

export const STORE_TIMEZONE = 'Africa/Casablanca';
export const SALES_RANGES = [7, 14, 30, 90] as const;
export type SalesRange = (typeof SALES_RANGES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" of an instant in the store timezone. */
function localDay(at: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
}

/** The `count` calendar days ending today (store timezone), oldest first. */
function dayKeys(count: number, endOffset = 0): string[] {
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

/** Per-day figures for every order placed since `since` (bucketed by local day). */
async function dailyRows(since: Date): Promise<DayRow[]> {
  return Order.aggregate<DayRow>([
    { $match: { createdAt: { $gte: since }, orderStatus: { $ne: 'cancelled' } } },
    {
      $project: {
        day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STORE_TIMEZONE } },
        status: '$orderStatus',
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
        completed: { $and: [{ $eq: ['$status', 'delivered'] }, { $lt: ['$refunded', { $subtract: ['$total', 0.005] }] }] },
      },
    },
    {
      $group: {
        _id: '$day',
        orders: { $sum: 1 },
        orderValue: { $sum: '$total' },
        completedOrders: { $sum: { $cond: ['$completed', 1, 0] } },
        revenue: { $sum: { $cond: ['$completed', { $subtract: [{ $subtract: ['$charged', '$discount'] }, '$refunded'] }, 0] } },
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
    { $match: { createdAt: { $gte: since }, orderStatus: 'delivered' } },
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
export async function salesAnalytics(range: SalesRange, canSeeProfit: boolean) {
  const current = dayKeys(range);
  const previous = dayKeys(range, range);
  // A little extra margin for the timezone offset; buckets outside the two periods are ignored
  const since = new Date(Date.now() - (range * 2 + 2) * DAY_MS);
  const [rows, best] = await Promise.all([dailyRows(since), topProducts(since, new Set(current))]);
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
