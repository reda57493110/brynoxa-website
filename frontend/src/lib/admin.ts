import type { OrderStatus } from '@/types'
import type { BadgeVariant } from '@/components/ui/Badge'

export function orderStatusVariant(status: string): BadgeVariant {
  if (status === 'delivered') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'shipped' || status === 'processing') return 'brand'
  if (status === 'confirmed') return 'success'
  return 'warning'
}

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]
