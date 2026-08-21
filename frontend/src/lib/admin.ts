import type { OrderStatus } from '@/types'
import type { BadgeVariant } from '@/components/ui/Badge'

export function orderStatusVariant(status: string): BadgeVariant {
  if (status === 'delivered') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'shipped') return 'brand'
  if (status === 'confirmed' || status === 'processing') return 'success'
  return 'warning'
}

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
]
