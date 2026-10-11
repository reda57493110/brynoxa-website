/**
 * Order status workflow (mirrored in frontend/src/lib/orderStatus.ts — keep both in sync).
 *
 * Order status says where the parcel is. Money lives elsewhere: paymentStatus, deposit and
 * refunds. Stock lives in the inventory ledger. A status change never edits refunds, and returned
 * units only become sellable after they are assessed on the return (Inventory → Returns).
 */

export const ORDER_STATUSES = [
  // Processing
  'pending',
  'no_answer',
  'confirmed',
  // Out for delivery
  'shipped',
  'delivery_failed',
  'rescheduled',
  // Completed
  'delivered',
  // Returns
  'return_requested',
  'return_in_transit',
  'partially_returned',
  'returned',
  // Closed
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderStatusGroup = 'processing' | 'delivery' | 'completed' | 'returns' | 'closed';

export const ORDER_STATUS_GROUP: Record<OrderStatus, OrderStatusGroup> = {
  pending: 'processing',
  no_answer: 'processing',
  confirmed: 'processing',
  shipped: 'delivery',
  delivery_failed: 'delivery',
  rescheduled: 'delivery',
  delivered: 'completed',
  return_requested: 'returns',
  return_in_transit: 'returns',
  partially_returned: 'returns',
  returned: 'returns',
  cancelled: 'closed',
};

export const ORDER_STATUS_GROUPS: OrderStatusGroup[] = ['processing', 'delivery', 'completed', 'returns', 'closed'];

export function statusesInGroup(group: OrderStatusGroup): OrderStatus[] {
  return ORDER_STATUSES.filter((s) => ORDER_STATUS_GROUP[s] === group);
}

/** Why a delivery attempt failed. */
export const DELIVERY_ISSUES = ['customer_unavailable', 'no_answer', 'address_issue', 'refused', 'other'] as const;
export type DeliveryIssue = (typeof DELIVERY_ISSUES)[number];

/**
 * Allowed moves. `returned` / `partially_returned` are only reached by registering the units that
 * came back (createReturn), never by picking a status, so stock always matches.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'no_answer', 'cancelled'],
  no_answer: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'delivery_failed', 'rescheduled', 'return_in_transit'],
  delivery_failed: ['shipped', 'rescheduled', 'delivered', 'return_in_transit'],
  rescheduled: ['shipped', 'delivered', 'delivery_failed', 'return_in_transit'],
  delivered: ['return_requested', 'return_in_transit'],
  return_requested: ['return_in_transit', 'delivered'],
  return_in_transit: [],
  partially_returned: ['return_requested', 'return_in_transit'],
  returned: [],
  cancelled: [],
};

/** Statuses set by registering received units, not by a plain status change. */
export const RECEIPT_STATUSES: OrderStatus[] = ['partially_returned', 'returned'];

/** Units are with the courier or the customer, so a return can be registered. */
export const RETURNABLE_STATUSES: OrderStatus[] = [
  'shipped',
  'delivery_failed',
  'rescheduled',
  'delivered',
  'return_requested',
  'return_in_transit',
  'partially_returned',
];

/** Still being worked on (not delivered, not closed). */
export const OPEN_STATUSES: OrderStatus[] = ['pending', 'no_answer', 'confirmed', 'shipped', 'delivery_failed', 'rescheduled'];

/** The customer paid for the goods: delivered now or at some point (returns keep the history). */
export function wasDelivered(order: { orderStatus: string; deliveredAt?: Date | null }) {
  return order.orderStatus === 'delivered' || Boolean(order.deliveredAt);
}

/** Never delivered and not going to be: cancelled, or sent back without delivery. */
export function closedWithoutSale(order: { orderStatus: string; deliveredAt?: Date | null }) {
  if (order.orderStatus === 'cancelled') return true;
  return order.orderStatus === 'returned' && !wasDelivered(order);
}

/** Aggregation: `$expr` that is true when the order was delivered (see wasDelivered). */
export const deliveredExpr = {
  $or: [{ $eq: ['$orderStatus', 'delivered'] }, { $eq: [{ $type: '$deliveredAt' }, 'date'] }],
};

/** Find filter for orders that were delivered (see wasDelivered). */
export const deliveredFilter = {
  $or: [{ orderStatus: 'delivered' }, { deliveredAt: { $type: 'date' } }],
};

/** Find filter for orders that still count as placed (not cancelled, not sent back undelivered). */
export const placedFilter = {
  orderStatus: { $ne: 'cancelled' },
  $nor: [{ orderStatus: 'returned', deliveredAt: { $exists: false } }],
};

/**
 * Orders staff should act on now. Mirrors needsAttention() in frontend/src/lib/orderStatus.ts.
 */
export function attentionFilter(now = new Date()) {
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  return {
    $or: [
      { orderStatus: { $in: ['no_answer', 'delivery_failed', 'return_requested'] } },
      { orderStatus: 'pending', createdAt: { $lt: dayAgo } },
      // Rescheduled day has started (stored as that day's midnight, Morocco time)
      { orderStatus: 'rescheduled', rescheduledFor: { $lte: now } },
      { orderStatus: 'return_in_transit', updatedAt: { $lt: weekAgo } },
      // Money held on an order that will not be (or is no longer) a sale, nothing refunded yet
      {
        orderStatus: { $in: ['cancelled', 'returned', 'partially_returned'] },
        refunds: { $size: 0 },
        $or: [{ 'deposit.status': 'received' }, { deliveredAt: { $type: 'date' } }, { paymentStatus: 'paid' }],
      },
    ],
  };
}
