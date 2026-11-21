import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { at } from '@/i18n/admin'
import type { CustomerType, SegmentKey } from '@/types'

/** In the admin language: getters read the text when shown, never copied at load. */
export const SEGMENT_LABELS: Record<SegmentKey, string> = {
  get new() { return at('cust.seg.new') },
  get repeat() { return at('cust.seg.repeat') },
  get 'high-spend'() { return at('cust.seg.high-spend') },
  get 'high-profit'() { return at('cust.seg.high-profit') },
  get inactive() { return at('cust.seg.inactive') },
  get wholesale() { return at('cust.seg.wholesale') },
  get 'wholesale-pending'() { return at('cust.seg.wholesale-pending') },
  get outstanding() { return at('cust.seg.outstanding') },
}

export const TYPE_LABELS: Record<CustomerType, string> = {
  get retail() { return at('cust.type.retail') },
  get wholesale() { return at('cust.type.wholesale') },
  get business() { return at('cust.type.business') },
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
  'source',
] as const
export type FilterKey = (typeof FILTER_KEYS)[number]
export type FilterValues = Record<FilterKey, string>
