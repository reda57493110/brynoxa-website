import { refundedTotal, wasDelivered } from '@/lib/orderStatus'
import type { Order } from '@/types'

const round2 = (n: number) => Math.round(n * 100) / 100

export const orderProductId = (p: Order['items'][number]['product']) => (typeof p === 'string' ? p : p._id)

/** What the customer actually paid (same rule as the server: fees the shop covered are not paid). */
export function paidOn(o: Pick<Order, 'orderStatus' | 'deliveredAt' | 'pricing' | 'deposit'>) {
  if (!wasDelivered(o)) return 0
  const fees = o.deposit?.status === 'received' ? Math.max(0, o.deposit.feeCredit ?? 0) : 0
  return round2(o.pricing.total - fees)
}

/** "Return & refund" applies: delivered, with products left to return or money left to refund. */
export function canReturnAndRefund(o: Order) {
  if (!wasDelivered(o)) return false
  const left = o.items.some((i) => i.qty - (i.returnedQty ?? 0) > 0)
  return left && paidOn(o) - refundedTotal(o) > 0.005
}
