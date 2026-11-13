/**
 * Admin → Ads & social media.
 *
 * - Campaigns (AdCampaign): an ad or a free post on a platform, with its tracking link.
 * - Spending: Expense rows (category 'ads', campaign = id), so ads also count in Admin → Profit.
 *   Ads expenses added in Profit without a campaign are shown as "Other ad spending".
 * - Results: orders whose `marketing.campaign` is the campaign's code (cancelled / returned not
 *   counted), their revenue, cost per order and return per 1 DH spent.
 */
import mongoose from 'mongoose';
import { AdCampaign, type IAdCampaign } from '../models/AdCampaign';
import { Expense } from '../models/Expense';
import { Order } from '../models/Order';
import { ApiError } from '../utils/ApiError';
import { roundMoney } from '../utils/deposit';
import { AD_PLATFORMS, UTM_MEDIUM, adResults, campaignCode, type AdKind, type AdPlatform } from '../utils/adTracking';
import { SALES_RANGES } from './dashboard.service';

/** 0 = since the start */
export const AD_RANGES = [0, ...SALES_RANGES] as const;
export type AdRange = (typeof AD_RANGES)[number];

/** Orders that do not count for a campaign */
export const AD_UNCOUNTED_STATUSES = ['cancelled', 'returned'];

const dayToDate = (s: string) => new Date(`${s}T12:00:00Z`);
const dayOf = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '');

function sinceOf(days: AdRange) {
  return days > 0 ? new Date(Date.now() - days * 86_400_000) : null;
}

function checkId(id: string, what = 'Campaign') {
  if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(404, `${what} not found`);
}

/** The link to put in the ad / post: shop page + utm values */
export function trackingQuery(c: Pick<IAdCampaign, 'platform' | 'kind' | 'code'>) {
  const q = new URLSearchParams({ utm_source: c.platform, utm_medium: UTM_MEDIUM[c.kind], utm_campaign: c.code });
  return q.toString();
}

function publicCampaign(c: IAdCampaign) {
  return {
    _id: String(c._id),
    name: c.name,
    code: c.code,
    platform: c.platform,
    kind: c.kind,
    landingPath: c.landingPath || '/',
    trackingQuery: trackingQuery(c),
    startDate: dayOf(c.startDate),
    endDate: dayOf(c.endDate),
    budget: typeof c.budget === 'number' ? c.budget : null,
    notes: c.notes ?? '',
    isActive: c.isActive,
    createdAt: c.createdAt,
  };
}

/** A free code: the name's code, or with -2, -3 … when taken */
async function freeCode(name: string, exceptId?: string) {
  const base = campaignCode(name);
  for (let i = 1; i < 200; i++) {
    const code = i === 1 ? base : `${base.slice(0, 44)}-${i}`;
    const taken = await AdCampaign.exists({ code, ...(exceptId ? { _id: { $ne: exceptId } } : {}) });
    if (!taken) return code;
  }
  return `${base.slice(0, 40)}-${Date.now().toString(36)}`;
}

type CampaignInput = {
  name?: string;
  platform?: AdPlatform;
  kind?: AdKind;
  landingPath?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  notes?: string;
  isActive?: boolean;
};

function fieldsOf(input: CampaignInput) {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  if (input.name !== undefined) set.name = input.name.trim();
  if (input.platform !== undefined) set.platform = input.platform;
  if (input.kind !== undefined) set.kind = input.kind;
  if (input.landingPath !== undefined) set.landingPath = input.landingPath.trim() || '/';
  for (const k of ['startDate', 'endDate'] as const) {
    if (input[k] === undefined) continue;
    if (input[k]) set[k] = dayToDate(input[k]!);
    else unset[k] = '';
  }
  if (input.budget !== undefined) set.budget = roundMoney(input.budget);
  if (input.notes !== undefined) set.notes = input.notes.trim();
  if (input.isActive !== undefined) set.isActive = input.isActive;
  return { set, unset };
}

function checkDates(start?: Date | string, end?: Date | string) {
  if (start && end && new Date(end).getTime() < new Date(start).getTime()) {
    throw new ApiError(400, 'The end date is before the start date');
  }
}

export async function createCampaign(input: CampaignInput, userId?: string) {
  const { set } = fieldsOf(input);
  checkDates(set.startDate as Date, set.endDate as Date);
  const c = await AdCampaign.create({
    kind: 'paid',
    ...set,
    code: await freeCode(String(set.name ?? '')),
    by: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : undefined,
  });
  return publicCampaign(c);
}

/** The code (and so the tracking link) never changes: links already shared keep working. */
export async function updateCampaign(id: string, input: CampaignInput) {
  checkId(id);
  const current = await AdCampaign.findById(id);
  if (!current) throw new ApiError(404, 'Campaign not found');
  const { set, unset } = fieldsOf(input);
  checkDates(
    'startDate' in unset ? undefined : ((set.startDate as Date) ?? current.startDate),
    'endDate' in unset ? undefined : ((set.endDate as Date) ?? current.endDate)
  );
  const c = await AdCampaign.findByIdAndUpdate(
    id,
    { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
    { new: true }
  );
  return publicCampaign(c!);
}

/** Deleting a campaign keeps its spending in Profit (the money was really spent), unlinked. */
export async function deleteCampaign(id: string) {
  checkId(id);
  const r = await AdCampaign.deleteOne({ _id: id });
  if (!r.deletedCount) throw new ApiError(404, 'Campaign not found');
  await Expense.updateMany({ campaign: id }, { $unset: { campaign: '' } });
}

export async function addSpend(id: string, input: { amount: number; day: string; note?: string }, userId?: string) {
  checkId(id);
  const c = await AdCampaign.findById(id).lean();
  if (!c) throw new ApiError(404, 'Campaign not found');
  const amount = roundMoney(input.amount);
  if (!(amount > 0)) throw new ApiError(400, 'Amount: enter more than 0');
  const e = await Expense.create({
    label: `Ad: ${c.name}`.slice(0, 120),
    category: 'ads',
    amount,
    date: dayToDate(input.day),
    note: input.note?.trim() || undefined,
    campaign: c._id,
    by: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : undefined,
  });
  return { id: String(e._id) };
}

export async function deleteSpend(id: string, spendId: string) {
  checkId(id);
  checkId(spendId, 'Spending');
  const r = await Expense.deleteOne({ _id: spendId, campaign: id });
  if (!r.deletedCount) throw new ApiError(404, 'Spending not found');
}

type OrderAgg = { _id: string; orders: number; revenue: number; delivered: number };

/** Everything on the Ads page for the chosen period */
export async function adsOverview(days: AdRange) {
  const since = sinceOf(days);
  const dateMatch = since ? { date: { $gte: since } } : {};
  const createdMatch = since ? { createdAt: { $gte: since } } : {};

  const [campaigns, spendRows, orderRows] = await Promise.all([
    AdCampaign.find().sort({ isActive: -1, createdAt: -1 }).lean<IAdCampaign[]>(),
    Expense.aggregate<{ _id: mongoose.Types.ObjectId | null; spent: number; entries: number }>([
      { $match: { category: 'ads', ...dateMatch } },
      { $group: { _id: { $ifNull: ['$campaign', null] }, spent: { $sum: '$amount' }, entries: { $sum: 1 } } },
    ]),
    Order.aggregate<OrderAgg & { source: string }>([
      {
        $match: {
          'marketing.campaign': { $exists: true, $ne: null },
          orderStatus: { $nin: AD_UNCOUNTED_STATUSES },
          ...createdMatch,
        },
      },
      {
        $group: {
          _id: '$marketing.campaign',
          source: { $first: '$marketing.source' },
          orders: { $sum: 1 },
          revenue: { $sum: '$pricing.total' },
          delivered: { $sum: { $cond: [{ $eq: ['$orderStatus', 'delivered'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const spentOf = new Map(spendRows.map((r) => [r._id ? String(r._id) : '', r.spent]));
  const ordersOf = new Map(orderRows.map((r) => [r._id, r]));
  const known = new Set(campaigns.map((c) => c.code));

  const rows = campaigns.map((c) => {
    const o = ordersOf.get(c.code);
    const spent = spentOf.get(String(c._id)) ?? 0;
    return {
      ...publicCampaign(c as IAdCampaign),
      ...adResults({ spent, orders: o?.orders ?? 0, revenue: o?.revenue ?? 0 }),
      delivered: o?.delivered ?? 0,
      budgetLeft: typeof c.budget === 'number' ? roundMoney(c.budget - spent) : null,
    };
  });

  // Orders from links whose campaign was deleted or typed by hand: by platform, as "other links"
  const otherOrders = orderRows.filter((r) => !known.has(r._id));
  const otherSpent = spentOf.get('') ?? 0;

  const platforms = [...AD_PLATFORMS]
    .map((platform) => {
      const mine = rows.filter((r) => r.platform === platform);
      const loose = otherOrders.filter((r) => (r.source || 'other') === platform);
      const spent = mine.reduce((a, r) => a + r.spent, 0);
      const orders = mine.reduce((a, r) => a + r.orders, 0) + loose.reduce((a, r) => a + r.orders, 0);
      const revenue = mine.reduce((a, r) => a + r.revenue, 0) + loose.reduce((a, r) => a + r.revenue, 0);
      return { platform, campaigns: mine.length, ...adResults({ spent, orders, revenue }) };
    })
    .filter((p) => p.campaigns || p.orders || p.spent);

  const allOrders = orderRows.reduce((a, r) => a + r.orders, 0);
  const allRevenue = orderRows.reduce((a, r) => a + r.revenue, 0);
  const allSpent = spendRows.reduce((a, r) => a + r.spent, 0);

  return {
    days,
    totals: { ...adResults({ spent: allSpent, orders: allOrders, revenue: allRevenue }), campaigns: campaigns.length, active: campaigns.filter((c) => c.isActive).length },
    /** "ads" expenses added in Profit without a campaign */
    otherSpent: roundMoney(otherSpent),
    /** Orders from tracking links of no saved campaign */
    otherLinks: adResults({ spent: 0, orders: otherOrders.reduce((a, r) => a + r.orders, 0), revenue: otherOrders.reduce((a, r) => a + r.revenue, 0) }),
    platforms,
    campaigns: rows,
  };
}

/** One campaign: its spending (newest first) and its latest orders */
export async function campaignDetail(id: string) {
  checkId(id);
  const c = await AdCampaign.findById(id).lean<IAdCampaign>();
  if (!c) throw new ApiError(404, 'Campaign not found');
  const [spends, orders] = await Promise.all([
    Expense.find({ campaign: c._id }).sort({ date: -1, createdAt: -1 }).limit(200).lean(),
    Order.find({ 'marketing.campaign': c.code })
      .sort({ createdAt: -1 })
      .limit(30)
      .select('orderNumber pricing.total orderStatus createdAt')
      .lean(),
  ]);
  return {
    campaign: publicCampaign(c),
    spends: spends.map((s) => ({ _id: String(s._id), amount: s.amount, day: dayOf(s.date), note: s.note ?? '' })),
    orders: orders.map((o) => ({
      _id: String(o._id),
      orderNumber: o.orderNumber,
      total: o.pricing?.total ?? 0,
      status: o.orderStatus,
      counted: !AD_UNCOUNTED_STATUSES.includes(o.orderStatus),
      createdAt: o.createdAt,
    })),
  };
}
