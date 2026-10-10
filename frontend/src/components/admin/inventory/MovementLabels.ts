import type { QueryClient } from '@tanstack/react-query'
import type { BadgeVariant } from '@/components/ui/Badge'
import type { MovementType, RepairRecord, RepairStatus, ReturnOutcome, StockMovement } from '@/types'
import { hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'

/** Shared labels / helpers for the inventory receive, returns, repairs and stock-log pages. */

export const invCard = 'min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] sm:rounded-2xl'

export const nativeSelect =
  'h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg)] outline-none ring-brand'

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
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

const BUCKET_LABELS: Record<string, string> = {
  available: 'Available',
  reserved: 'Reserved',
  awaitingInspection: 'Awaiting inspection',
  returned: 'Returned',
  defective: 'Defective',
  underRepair: 'Under repair',
  writtenOff: 'Written off',
  sold: 'Sold',
  external: 'outside the store',
}

/** Friendly name for a bucket, 'external' or 'custom:<id>'. */
export function bucketLabel(bucket: string | undefined | null): string {
  if (!bucket) return '—'
  if (bucket.startsWith('custom:')) return bucket.slice('custom:'.length)
  return BUCKET_LABELS[bucket] ?? bucket
}

export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  'awaiting-diagnosis': 'Awaiting diagnosis',
  'awaiting-parts': 'Awaiting parts',
  'in-repair': 'In repair',
  'repair-completed': 'Repair completed',
  'qc-pending': 'QC pending',
  'qc-passed': 'QC passed',
  'qc-failed': 'QC failed',
}

export function repairStatusVariant(status: RepairStatus): BadgeVariant {
  switch (status) {
    case 'qc-passed':
      return 'success'
    case 'qc-failed':
      return 'danger'
    case 'repair-completed':
    case 'qc-pending':
      return 'brand'
    case 'awaiting-parts':
      return 'warning'
    default:
      return 'default'
  }
}

export const REPAIR_SOURCE_LABELS: Record<RepairRecord['source'], string> = {
  receipt: 'Delivery',
  return: 'Return',
  stock: 'Stock',
}

export const RETURN_OUTCOME_LABELS: Record<ReturnOutcome, string> = {
  'restock-new': 'Restocked as new',
  used: 'Sell as used',
  repair: 'Sent to repair',
  defective: 'Defective',
  'write-off': 'Written off',
}

export const FINAL_STATUS_LABELS: Record<NonNullable<RepairRecord['finalStatus']>, string> = {
  new: 'Sold as new',
  refurbished: 'Refurbished',
  used: 'Used',
  defective: 'Defective',
  'write-off': 'Written off',
}

type ByRef = { _id: string; name?: string } | string | undefined | null

export function byName(by: ByRef): string {
  if (!by) return '—'
  if (typeof by === 'string') return 'Staff'
  return by.name || 'Staff'
}

export function refId(ref: { _id: string } | string | undefined | null): string | undefined {
  if (!ref) return undefined
  return typeof ref === 'string' ? ref : ref._id
}

/** One value per line or comma; trimmed, de-duplicated. */
export function parseList(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )
}

export function todayInput(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Refresh everything that shows stock after a server-side inventory change. */
export function invalidateInventory(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['admin-inventory'] })
  qc.invalidateQueries({ queryKey: ['admin-products'] })
  qc.invalidateQueries({ queryKey: ['admin-product'] })
}

/** Approving repaired units for sale and write-offs need 'inventory:approve'. */
export function useCanApprove(): boolean {
  const role = useAuthStore((s) => s.user?.role)
  return hasPermission(role, 'inventory:approve')
}

export function returnCustomerName(c: { name?: string; email?: string } | string | undefined | null): string {
  if (!c) return '—'
  if (typeof c === 'string') return 'Customer'
  return c.name || c.email || 'Customer'
}

export function movementProduct(m: StockMovement) {
  return typeof m.product === 'string' ? { _id: m.product, name: m.sku, sku: m.sku } : m.product
}

export const movementTypeLabel = (t: StockMovement['type']) => MOVEMENT_TYPE_LABELS[t] ?? t
