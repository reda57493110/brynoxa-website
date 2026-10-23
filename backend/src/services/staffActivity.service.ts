import type { IncomingMessage, ServerResponse } from 'http';
import mongoose, { Types } from 'mongoose';
import { waitUntil } from '@vercel/functions';
import { StaffAction } from '../models/StaffAction';
import { Order, type OrderStatus } from '../models/Order';
import { User } from '../models/User';
import { STAFF_ROLES } from '../permissions';
import { ApiError } from '../utils/ApiError';
import { ORDER_STATUS_GROUP } from '../utils/orderStatus';
import { describeStaffAction, logicalApiPath } from '../utils/staffActions';

/**
 * Admin → Roles → staff activity: what each staff member did and whether their orders got done.
 * Order work comes from the orders' own history (each step records who made it); everything else
 * (products, stock, coupons, settings…) from the StaffAction log written below.
 */

const DAY = 86_400_000;
const PERIODS = [7, 30, 90, 365] as const;
export const periodDays = (v: unknown) => (PERIODS as readonly number[]).includes(Number(v)) ? Number(v) : 30;

type TrackedRequest = IncomingMessage & { originalUrl?: string; __staffTracked?: boolean };

/**
 * Called by the staff checks (Express and the server functions): once a change by a staff member
 * succeeded, it is added to the activity log. Reads (GET) are not logged.
 */
export function trackStaffRequest(req: TrackedRequest, res: ServerResponse, user: { id: string; role: string }) {
  try {
    if (req.__staffTracked) return;
    const method = (req.method || 'GET').toUpperCase();
    const path = logicalApiPath(req.originalUrl || req.url || '');
    const info = describeStaffAction(method, path);
    if (!info) return;
    req.__staffTracked = true;
    const written = new Promise<void>((resolve) => {
      res.once('finish', () => {
        if (res.statusCode >= 400) return resolve();
        StaffAction.create({ user: user.id, role: user.role, ...info, method, path: path.slice(0, 300), at: new Date() })
          .catch((err) => console.warn('Staff activity not saved:', err?.message))
          .finally(resolve);
      });
      res.once('close', () => {
        if (!res.writableFinished) resolve();
      });
    });
    // Serverless: keep the function alive until the line is written
    waitUntil(written);
  } catch (err) {
    console.warn('Staff activity hook failed:', (err as Error)?.message);
  }
}

/** A staff sign-in (password, and the 2-step code when it is on). */
export function recordStaffSignIn(userId: string, role: string) {
  waitUntil(
    StaffAction.create({ user: userId, role, action: 'Signed in', kind: 'sign-in', method: 'POST', path: 'auth/login', at: new Date() }).then(
      () => undefined,
      (err) => console.warn('Staff sign-in not saved:', err?.message)
    )
  );
}

const STATUS_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: 'New',
  confirmed: 'Confirmed',
  no_answer: 'No answer',
  shipped: 'Shipped',
  delivered: 'Delivered',
  delivery_failed: 'Delivery failed',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  return_in_transit: 'Return on the way',
  partially_returned: 'Partly returned',
  returned: 'Returned',
};

const CONTACT_OUTCOME: Record<string, string> = {
  reached: 'reached',
  no_answer: 'no answer',
  busy: 'busy',
  wrong_number: 'wrong number',
  switched_off: 'phone off',
  message_sent: 'message sent',
};

async function staffUsers(ids?: Types.ObjectId[]) {
  return User.find({ role: { $in: STAFF_ROLES }, ...(ids ? { _id: { $in: ids } } : {}) })
    .select('name email role isActive createdAt')
    .sort({ role: 1, name: 1 })
    .lean<{ _id: Types.ObjectId; name: string; email: string; role: string; isActive: boolean; createdAt: Date }[]>();
}

/** Order steps per staff member and status since `since`. */
async function orderSteps(ids: Types.ObjectId[], since: Date) {
  return Order.aggregate<{ _id: { by: Types.ObjectId; status: OrderStatus }; n: number }>([
    { $match: { timeline: { $elemMatch: { by: { $in: ids }, at: { $gte: since } } } } },
    { $unwind: '$timeline' },
    { $match: { 'timeline.by': { $in: ids }, 'timeline.at': { $gte: since } } },
    { $group: { _id: { by: '$timeline.by', status: '$timeline.status' }, n: { $sum: 1 } } },
  ]);
}

async function contactCounts(ids: Types.ObjectId[], since: Date) {
  return Order.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { contactAttempts: { $elemMatch: { by: { $in: ids }, at: { $gte: since } } } } },
    { $unwind: '$contactAttempts' },
    { $match: { 'contactAttempts.by': { $in: ids }, 'contactAttempts.at': { $gte: since } } },
    { $group: { _id: '$contactAttempts.by', n: { $sum: 1 } } },
  ]);
}

/** Orders a staff member confirmed (or added) in the period, by where they are now. */
async function handledOrders(id: Types.ObjectId, since: Date) {
  return Order.find({
    $or: [
      { timeline: { $elemMatch: { by: id, status: 'confirmed', at: { $gte: since } } } },
      { createdBy: id, createdAt: { $gte: since } },
    ],
  })
    .select('orderNumber orderStatus createdAt updatedAt pricing.total shippingAddress.fullName')
    .sort({ createdAt: -1 })
    .limit(500)
    .lean<{ _id: Types.ObjectId; orderNumber: string; orderStatus: OrderStatus; createdAt: Date; updatedAt: Date; pricing: { total: number }; shippingAddress?: { fullName?: string } }[]>();
}

function outcomeOf(status: OrderStatus): 'done' | 'open' | 'returned' | 'cancelled' {
  const g = ORDER_STATUS_GROUP[status];
  if (g === 'completed') return 'done';
  if (g === 'returns') return 'returned';
  if (g === 'closed') return 'cancelled';
  return 'open';
}

/** Admin → Roles: one line per staff member for the period. */
export async function teamActivity(days: number) {
  const since = new Date(Date.now() - days * DAY);
  const staff = await staffUsers();
  const ids = staff.map((s) => s._id);
  const [steps, contacts, actions, lastSeen, added] = await Promise.all([
    orderSteps(ids, since),
    contactCounts(ids, since),
    StaffAction.aggregate<{ _id: { user: Types.ObjectId; kind: string }; n: number }>([
      { $match: { user: { $in: ids }, at: { $gte: since } } },
      { $group: { _id: { user: '$user', kind: '$kind' }, n: { $sum: 1 } } },
    ]),
    StaffAction.aggregate<{ _id: Types.ObjectId; at: Date }>([
      { $match: { user: { $in: ids } } },
      { $group: { _id: '$user', at: { $max: '$at' } } },
    ]),
    Order.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { createdBy: { $in: ids }, createdAt: { $gte: since } } },
      { $group: { _id: '$createdBy', n: { $sum: 1 } } },
    ]),
  ]);
  return {
    days,
    staff: staff.map((s) => {
      const key = String(s._id);
      const mine = steps.filter((x) => String(x._id.by) === key);
      const byStatus = (st: OrderStatus) => mine.filter((x) => x._id.status === st).reduce((a, x) => a + x.n, 0);
      const myActions = actions.filter((a) => String(a._id.user) === key);
      return {
        _id: key,
        name: s.name,
        email: s.email,
        role: s.role,
        isActive: s.isActive,
        lastActive: lastSeen.find((l) => String(l._id) === key)?.at ?? null,
        signIns: myActions.filter((a) => a._id.kind === 'sign-in').reduce((a, x) => a + x.n, 0),
        // Changes outside orders (products, stock, coupons…); order steps are counted below
        changes: myActions.filter((a) => !['sign-in', 'order-status', 'order-contact'].includes(a._id.kind)).reduce((a, x) => a + x.n, 0),
        orderSteps: mine.reduce((a, x) => a + x.n, 0),
        confirmed: byStatus('confirmed'),
        shipped: byStatus('shipped'),
        delivered: byStatus('delivered'),
        cancelled: byStatus('cancelled'),
        calls: contacts.find((c) => String(c._id) === key)?.n ?? 0,
        ordersAdded: added.find((a) => String(a._id) === key)?.n ?? 0,
      };
    }),
  };
}

type FeedItem = { at: Date; action: string; kind: string; link?: string; detail?: string };

/** Admin → Roles → one staff member: figures, unfinished orders and everything they did. */
export async function staffActivity(userId: string, days: number) {
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(404, 'Staff member not found');
  const [member] = await staffUsers([new Types.ObjectId(userId)]);
  if (!member) throw new ApiError(404, 'Staff member not found');
  const id = member._id;
  const since = new Date(Date.now() - days * DAY);

  const [summary, handled, actionDocs, stepOrders] = await Promise.all([
    teamActivity(days).then((t) => t.staff.find((s) => s._id === String(id))!),
    handledOrders(id, since),
    StaffAction.find({ user: id, at: { $gte: since } }).sort({ at: -1 }).limit(300).lean(),
    Order.find({
      $or: [
        { timeline: { $elemMatch: { by: id, at: { $gte: since } } } },
        { contactAttempts: { $elemMatch: { by: id, at: { $gte: since } } } },
      ],
    })
      .select('orderNumber timeline contactAttempts')
      .sort({ updatedAt: -1 })
      .limit(300)
      .lean<{ _id: Types.ObjectId; orderNumber: string; timeline: { status: OrderStatus; note?: string; at: Date; by?: Types.ObjectId }[]; contactAttempts?: { channel: string; outcome: string; note?: string; at: Date; by?: Types.ObjectId }[] }[]>(),
  ]);

  const feed: FeedItem[] = [];
  for (const o of stepOrders) {
    const link = `/admin/orders/${o._id}`;
    for (const t of o.timeline || []) {
      if (String(t.by) !== String(id) || new Date(t.at) < since) continue;
      feed.push({ at: t.at, kind: 'order-status', link, action: `Order #${o.orderNumber} → ${STATUS_LABEL[t.status] ?? t.status}`, detail: t.note });
    }
    for (const c of o.contactAttempts || []) {
      if (String(c.by) !== String(id) || new Date(c.at) < since) continue;
      const how = c.channel === 'call' ? 'Called' : c.channel === 'whatsapp' ? 'WhatsApp to' : c.channel === 'sms' ? 'SMS to' : 'Email to';
      feed.push({ at: c.at, kind: 'order-contact', link, action: `${how} the customer of #${o.orderNumber} — ${CONTACT_OUTCOME[c.outcome] ?? c.outcome}`, detail: c.note });
    }
  }
  for (const a of actionDocs) {
    // Order steps and calls are listed above with their details
    if (a.kind === 'order-status' || a.kind === 'order-contact') continue;
    const link =
      a.targetId && a.kind === 'order' ? `/admin/orders/${a.targetId}`
        : a.targetId && a.kind === 'product' ? `/admin/products/${a.targetId}/edit`
          : a.targetId && a.kind === 'customer' ? `/admin/customers/${a.targetId}`
            : undefined;
    feed.push({ at: a.at, kind: a.kind, link, action: a.action });
  }
  feed.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());

  const outcomes = { done: 0, open: 0, returned: 0, cancelled: 0 };
  for (const o of handled) outcomes[outcomeOf(o.orderStatus)] += 1;
  const DAY_OLD = 2 * DAY;
  const unfinished = handled
    .filter((o) => outcomeOf(o.orderStatus) === 'open')
    .map((o) => ({
      _id: String(o._id),
      orderNumber: o.orderNumber,
      status: o.orderStatus,
      statusLabel: STATUS_LABEL[o.orderStatus] ?? o.orderStatus,
      customer: o.shippingAddress?.fullName ?? '',
      total: o.pricing.total,
      since: o.updatedAt,
      // Not moved for 2 days: worth a look
      stuck: Date.now() - new Date(o.updatedAt).getTime() > DAY_OLD,
    }));

  const activeDays = new Set(feed.map((f) => new Date(f.at).toISOString().slice(0, 10))).size;

  return {
    days,
    member: { _id: String(id), name: member.name, email: member.email, role: member.role, isActive: member.isActive, since: member.createdAt },
    summary: { ...summary, activeDays },
    handled: { total: handled.length, ...outcomes, finishedRate: handled.length ? Math.round(((outcomes.done + outcomes.returned + outcomes.cancelled) / handled.length) * 100) : null },
    unfinished,
    feed: feed.slice(0, 300),
  };
}
