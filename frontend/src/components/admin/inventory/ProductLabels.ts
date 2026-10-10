import type { BadgeVariant } from '@/components/ui/Badge'
import type { InventoryStatusDef, MovementType, ProductCondition } from '@/types'

/** Short, readable names for every inventory status. */
export const BUCKET_LABELS: Record<string, string> = {
  available: 'Sellable',
  reserved: 'Reserved',
  awaitingInspection: 'To inspect',
  returned: 'Returns',
  defective: 'Defective',
  underRepair: 'In repair',
  writtenOff: 'Written off',
  external: 'Outside the store',
  sold: 'Sold',
}

export function bucketLabel(bucket: string, statuses?: InventoryStatusDef[]) {
  if (bucket.startsWith('custom:')) {
    const id = bucket.slice(7)
    return statuses?.find((s) => s.id === id)?.name || 'Custom status'
  }
  return BUCKET_LABELS[bucket] || bucket
}

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  'supplier-receipt': 'Delivery',
  'customer-return': 'Customer return',
  'order-reservation': 'Reserved for order',
  'order-dispatch': 'Shipped',
  'reservation-release': 'Reservation released',
  'condition-change': 'Status change',
  'repair-transfer': 'To repair',
  'repair-completion': 'Repair finished',
  'listing-transfer': 'Moved to listing',
  'stock-adjustment': 'Adjustment',
  'write-off': 'Write-off',
}

export const CONDITION_META: Record<ProductCondition, { label: string; variant: BadgeVariant }> = {
  new: { label: 'New', variant: 'success' },
  refurbished: { label: 'Refurbished', variant: 'brand' },
  used: { label: 'Used', variant: 'warning' },
}

export function conditionLabel(c?: ProductCondition) {
  return CONDITION_META[c || 'new']?.label ?? c
}

export function pctText(v: number | null | undefined) {
  return v === null || v === undefined ? '—' : `${Math.round(v * 10) / 10}%`
}
