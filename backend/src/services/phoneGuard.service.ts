/**
 * Protection against fake cash-on-delivery orders:
 * - blocked numbers cannot order on the website (both order paths call assertPhoneAllowed before
 *   anything else, even before an account is created at checkout);
 * - the history of a number (orders delivered, refused / sent back, cancelled) shown on an order,
 *   so staff know whom they are calling before shipping.
 */
import mongoose from 'mongoose';
import { BlockedPhone } from '../models/BlockedPhone';
import { Order } from '../models/Order';
import { ApiError } from '../utils/ApiError';
import { phoneSearchRegex } from '../utils/phoneSearch';

/** Same number however it is written: its last 9 digits */
export function blockKey(phone?: unknown) {
  return String(phone ?? '').replace(/\D/g, '').slice(-9);
}

export const PHONE_BLOCKED = 'PHONE_BLOCKED';

/** Refuses a website order from a blocked number (the shop shows a translated message for the code) */
export async function assertPhoneAllowed(phone?: unknown) {
  const key = blockKey(phone);
  if (key.length < 8) return;
  let blocked = false;
  try {
    blocked = Boolean(await BlockedPhone.exists({ key }));
  } catch (err) {
    // Fails open, like the rate limits: a real customer's order matters more than one blocked number
    console.error('Blocked-number check failed:', err instanceof Error ? err.message : err);
  }
  if (blocked) {
    throw new ApiError(403, 'This order cannot be placed online. Please contact us on WhatsApp.', undefined, PHONE_BLOCKED);
  }
}

export async function listBlocked() {
  const rows = await BlockedPhone.find().sort({ createdAt: -1 }).limit(500).populate('by', 'name').lean();
  return rows.map((r) => ({
    _id: String(r._id),
    phone: r.phone,
    reason: r.reason ?? '',
    by: (r.by as unknown as { name?: string } | null)?.name ?? '',
    createdAt: r.createdAt,
  }));
}

export async function blockPhone(input: { phone: string; reason?: string }, userId?: string) {
  const key = blockKey(input.phone);
  if (key.length < 8) throw new ApiError(400, 'Enter a full phone number');
  const existing = await BlockedPhone.findOne({ key });
  if (existing) return { _id: String(existing._id), already: true };
  const row = await BlockedPhone.create({
    key,
    phone: String(input.phone).trim().slice(0, 40),
    reason: input.reason?.trim() || undefined,
    by: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : undefined,
  });
  return { _id: String(row._id), already: false };
}

/** By the row id, or by a phone number (the order page unblocks the number it shows) */
export async function unblockPhone(idOrPhone: string) {
  const filter = mongoose.Types.ObjectId.isValid(idOrPhone) ? { _id: idOrPhone } : { key: blockKey(idOrPhone) };
  const r = await BlockedPhone.deleteOne(filter);
  if (!r.deletedCount) throw new ApiError(404, 'This number is not blocked');
}

type HistoryOrder = {
  _id: unknown;
  orderNumber: string;
  orderStatus: string;
  createdAt: Date;
  deliveredAt?: Date;
  deliveryAttempts?: number;
  deliveryIssue?: { reason?: string };
  pricing?: { total?: number };
};

export type PhoneRisk = 'blocked' | 'high' | 'watch' | 'good' | 'new';

/** What a number's past orders say (the order being looked at is left out) */
export function summarizeHistory(orders: HistoryOrder[], blocked: boolean) {
  let delivered = 0;
  let refused = 0;
  let cancelled = 0;
  let failedAttempts = 0;
  for (const o of orders) {
    failedAttempts += o.deliveryAttempts ?? 0;
    if (o.orderStatus === 'delivered' || o.orderStatus === 'partially_returned' || o.orderStatus === 'return_requested') delivered++;
    else if (o.orderStatus === 'cancelled') cancelled++;
    // Sent back without ever being delivered, or the courier reported a refusal
    if ((['returned', 'return_in_transit'].includes(o.orderStatus) && !o.deliveredAt) || o.deliveryIssue?.reason === 'refused') refused++;
  }
  const risk: PhoneRisk = blocked
    ? 'blocked'
    : refused >= 1
      ? 'high'
      : cancelled >= 2 || failedAttempts >= 3
        ? 'watch'
        : delivered >= 1
          ? 'good'
          : 'new';
  return { orders: orders.length, delivered, refused, cancelled, failedAttempts, risk };
}

export async function phoneHistory(phone: string, excludeOrderId?: string) {
  const rx = phoneSearchRegex(String(phone ?? ''));
  const key = blockKey(phone);
  if (!rx || key.length < 8) {
    return { blocked: null, ...summarizeHistory([], false), recent: [] };
  }
  const exclude = excludeOrderId && mongoose.Types.ObjectId.isValid(excludeOrderId) ? { _id: { $ne: excludeOrderId } } : {};
  const [blocked, orders] = await Promise.all([
    BlockedPhone.findOne({ key }).lean(),
    Order.find({ 'shippingAddress.phone': rx, ...exclude })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('orderNumber orderStatus createdAt deliveredAt deliveryAttempts deliveryIssue pricing.total')
      .lean<HistoryOrder[]>(),
  ]);
  return {
    blocked: blocked ? { _id: String(blocked._id), reason: blocked.reason ?? '', createdAt: blocked.createdAt } : null,
    ...summarizeHistory(orders, Boolean(blocked)),
    recent: orders.slice(0, 8).map((o) => ({
      _id: String(o._id),
      orderNumber: o.orderNumber,
      status: o.orderStatus,
      total: o.pricing?.total ?? 0,
      createdAt: o.createdAt,
    })),
  };
}
