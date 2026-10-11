import type { BadgeVariant } from '@/components/ui/Badge'
import type { Order, OrderStatus } from '@/types'

/**
 * Order status workflow — mirror of backend/src/utils/orderStatus.ts (keep both in sync).
 * Order status = where the parcel is. Payment (deposit, COD, refunds) and stock are separate.
 */

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'no_answer',
  'confirmed',
  'shipped',
  'delivery_failed',
  'rescheduled',
  'delivered',
  'return_requested',
  'return_in_transit',
  'partially_returned',
  'returned',
  'cancelled',
]

export type OrderStatusGroup = 'processing' | 'delivery' | 'completed' | 'returns' | 'closed'

export const ORDER_STATUS_GROUP: Record<OrderStatus, OrderStatusGroup> = {
  pending: 'processing',
  no_answer: 'processing',
  confirmed: 'processing',
  processing: 'processing',
  shipped: 'delivery',
  delivery_failed: 'delivery',
  rescheduled: 'delivery',
  delivered: 'completed',
  return_requested: 'returns',
  return_in_transit: 'returns',
  partially_returned: 'returns',
  returned: 'returns',
  cancelled: 'closed',
}

export const ORDER_GROUPS: { id: OrderStatusGroup; label: string }[] = [
  { id: 'processing', label: 'Processing' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'completed', label: 'Completed' },
  { id: 'returns', label: 'Returns' },
  { id: 'closed', label: 'Cancelled' },
]

export function statusesInGroup(group: OrderStatusGroup) {
  return ORDER_STATUSES.filter((s) => ORDER_STATUS_GROUP[s] === group)
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  no_answer: 'No answer',
  confirmed: 'Confirmed',
  processing: 'Confirmed',
  shipped: 'Shipped',
  delivery_failed: 'Delivery failed',
  rescheduled: 'Rescheduled',
  delivered: 'Delivered',
  return_requested: 'Return requested',
  return_in_transit: 'Return in transit',
  partially_returned: 'Partially returned',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status.replace(/_/g, ' ')
}

/** Badge colour: processing = neutral/amber, delivery issues = amber/red, returns = violet-ish (brand), done = green. */
export function orderStatusVariant(status: string): BadgeVariant {
  switch (status) {
    case 'delivered':
    case 'confirmed':
    case 'processing':
      return 'success'
    case 'shipped':
    case 'rescheduled':
      return 'brand'
    case 'delivery_failed':
    case 'cancelled':
      return 'danger'
    case 'return_requested':
    case 'return_in_transit':
    case 'partially_returned':
    case 'returned':
      return 'muted'
    default:
      return 'warning'
  }
}

/** Dot colour for group chips. */
export const GROUP_DOT: Record<OrderStatusGroup, string> = {
  processing: 'bg-amber-500',
  delivery: 'bg-sky-500',
  completed: 'bg-emerald-500',
  returns: 'bg-violet-500',
  closed: 'bg-rose-500',
}

export const DELIVERY_ISSUES = [
  { value: 'customer_unavailable', label: 'Customer unavailable' },
  { value: 'no_answer', label: 'Customer did not answer' },
  { value: 'address_issue', label: 'Address problem' },
  { value: 'refused', label: 'Customer refused the parcel' },
  { value: 'other', label: 'Other' },
] as const

export type DeliveryIssue = (typeof DELIVERY_ISSUES)[number]['value']

export function deliveryIssueLabel(reason?: string) {
  return DELIVERY_ISSUES.find((d) => d.value === reason)?.label ?? reason ?? ''
}

/** Allowed next statuses. Returned / partially returned come from registering returned items. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'no_answer', 'cancelled'],
  no_answer: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'delivery_failed', 'rescheduled', 'return_in_transit'],
  delivery_failed: ['shipped', 'rescheduled', 'delivered', 'return_in_transit'],
  rescheduled: ['shipped', 'delivered', 'delivery_failed', 'return_in_transit'],
  delivered: ['return_requested', 'return_in_transit'],
  return_requested: ['return_in_transit', 'delivered'],
  return_in_transit: [],
  partially_returned: ['return_requested', 'return_in_transit'],
  returned: [],
  cancelled: [],
}

/** Statuses where the parcel left the store, so returned items can be registered. */
export const RETURNABLE_STATUSES: OrderStatus[] = [
  'shipped',
  'delivery_failed',
  'rescheduled',
  'delivered',
  'return_requested',
  'return_in_transit',
  'partially_returned',
]

/** Label of the action button that moves an order to `status`. */
export const TRANSITION_LABEL: Partial<Record<OrderStatus, string>> = {
  confirmed: 'Confirm',
  no_answer: 'No answer',
  cancelled: 'Cancel order',
  shipped: 'Mark shipped',
  delivered: 'Mark delivered',
  delivery_failed: 'Delivery failed',
  rescheduled: 'Reschedule',
  return_requested: 'Return requested',
  return_in_transit: 'Return in transit',
}

export function wasDelivered(o: Pick<Order, 'orderStatus' | 'deliveredAt'>) {
  return o.orderStatus === 'delivered' || Boolean(o.deliveredAt)
}

/** Money the customer actually paid: the total once delivered, else a received deposit. */
export function amountPaid(o: Order) {
  if (wasDelivered(o)) return o.pricing.total
  return o.deposit?.status === 'received' ? o.deposit.amount : 0
}

export function refundedTotal(o: Order) {
  return (o.refunds || []).reduce((a, r) => a + r.amount, 0)
}

/**
 * Refund state from the money records (never from the status alone):
 * - due: money held on a cancelled / returned order and nothing refunded yet
 * - partial: some refunded, some still held
 * - refunded: everything paid was given back
 */
export function refundState(o: Order): 'due' | 'partial' | 'refunded' | null {
  const paid = amountPaid(o)
  const refunded = refundedTotal(o)
  if (paid <= 0) return null
  if (refunded >= paid - 0.005) return 'refunded'
  const shouldRefund = ['cancelled', 'returned', 'partially_returned'].includes(o.orderStatus)
  if (refunded > 0) return 'partial'
  return shouldRefund ? 'due' : null
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Why staff should look at this order now (empty = nothing to do). Mirrors attentionFilter()
 * on the backend, which powers the "Needs attention" filter.
 */
export function attentionReasons(o: Order, now = Date.now()): string[] {
  const reasons: string[] = []
  const created = new Date(o.createdAt).getTime()
  if (o.orderStatus === 'pending' && now - created > DAY) reasons.push('Waiting over 24 h')
  if (o.orderStatus === 'no_answer') reasons.push('Call the customer again')
  if (o.orderStatus === 'delivery_failed') reasons.push('Arrange a new delivery')
  if (o.orderStatus === 'rescheduled' && o.rescheduledFor && new Date(o.rescheduledFor).getTime() <= now) {
    reasons.push('Delivery due')
  }
  if (o.orderStatus === 'return_requested') reasons.push('Arrange the return')
  if (o.orderStatus === 'return_in_transit' && now - new Date(o.updatedAt).getTime() > 7 * DAY) {
    reasons.push('Return not received after 7 days')
  }
  if (refundState(o) === 'due' && !(o.refunds || []).length) reasons.push('Refund due')
  return reasons
}

export function formatDeliveryDay(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(value)
  )
}
