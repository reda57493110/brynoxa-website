import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { ProductCondition } from '@/types'
import { CONDITION_META } from './ProductLabels'

export function ConditionBadge({ condition }: { condition?: ProductCondition }) {
  const meta = CONDITION_META[condition || 'new'] ?? CONDITION_META.new
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

/** Stock value, or "No cost data" — never an estimate. */
export function ValueText({ value, className }: { value: number | null; className?: string }) {
  if (value === null) {
    return <span className={cn('text-xs text-[var(--warning)]', className)}>No cost data</span>
  }
  return <span className={className}>{formatCurrency(value)}</span>
}

/** Two-part bar that makes "in stock" vs "sellable" obvious. */
export function SellableBar({ sellable, nonSellable }: { sellable: number; nonSellable: number }) {
  const total = sellable + nonSellable
  const share = total > 0 ? (sellable / total) * 100 : 0
  return (
    <div className="min-w-0">
      <div className="flex h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]" aria-hidden>
        <div className="h-full bg-[var(--success)]" style={{ width: `${share}%` }} />
        <div className="h-full flex-1 bg-[color-mix(in_srgb,var(--warning)_55%,transparent)]" />
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-xs">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--success)]" />
          Sellable <strong>{sellable}</strong>
        </span>
        <span className="text-[var(--fg-muted)]">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-[color-mix(in_srgb,var(--warning)_55%,transparent)]" />
          Not sellable <strong className="text-[var(--fg)]">{nonSellable}</strong>
        </span>
      </div>
    </div>
  )
}
