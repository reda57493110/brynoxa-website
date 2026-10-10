import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { CustomerType, SegmentKey } from '@/types'

export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  new: 'New',
  repeat: 'Repeat',
  'high-spend': 'High-spending',
  'high-profit': 'High-profit',
  inactive: 'Inactive',
  wholesale: 'Wholesale',
  'wholesale-pending': 'Pending wholesale',
  outstanding: 'Outstanding balance',
}

export const TYPE_LABELS: Record<CustomerType, string> = {
  retail: 'Retail',
  wholesale: 'Wholesale',
  business: 'Business',
}

export function money(v: number | null | undefined) {
  return v === null || v === undefined ? '—' : formatCurrency(v)
}

export function pct(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  // Backend already returns margin as a percentage (e.g. 24.5).
  return `${v.toFixed(1)}%`
}

export function chipClass(active: boolean) {
  return cn(
    'h-8 shrink-0 rounded-full border px-2.5 text-xs whitespace-nowrap sm:h-9 sm:px-3 sm:text-sm',
    active
      ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
      : 'border-[var(--border)]'
  )
}

/* ---------- Period filter ---------- */

export interface Period {
  from: string
  to: string
}

function ymd(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function presetPeriod(preset: 'all' | '30d' | 'year'): Period {
  const now = new Date()
  if (preset === '30d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 30)
    return { from: ymd(start), to: ymd(now) }
  }
  if (preset === 'year') return { from: `${now.getFullYear()}-01-01`, to: ymd(now) }
  return { from: '', to: '' }
}

/** Filter keys stored in the URL and sent to the list endpoint. */
export const FILTER_KEYS = [
  'type',
  'status',
  'registeredFrom',
  'registeredTo',
  'activity',
  'minNet',
  'maxNet',
  'minOrders',
  'maxOrders',
  'minProfit',
] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
export type FilterValues = Record<FilterKey, string>
