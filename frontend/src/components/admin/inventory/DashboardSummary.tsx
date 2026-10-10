import { StatCard, cardClass } from '@/components/admin/customers/shared'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { InventorySummary } from '@/types'
import { SellableBar } from './ProductBadges'

export function DashboardSummary({
  summary,
  lowActive,
  onLowStock,
}: {
  summary: InventorySummary
  lowActive: boolean
  onLowStock: () => void
}) {
  const u = summary.units
  const cards: { label: string; value: number | string; hint?: string }[] = [
    { label: 'Sellable', value: u.sellable },
    { label: 'Reserved', value: u.reserved },
    { label: 'To inspect', value: u.awaitingInspection },
    { label: 'Returns', value: u.returned },
    { label: 'Defective', value: u.defective },
    { label: 'In repair', value: u.underRepair },
    { label: 'Refurbished', value: u.refurbishedAvailable, hint: 'Sellable' },
    { label: 'Used', value: u.usedAvailable, hint: 'Sellable' },
    ...u.custom.map((c) => ({ label: c.name, value: c.units, hint: 'Custom' })),
    { label: 'Written off', value: u.writtenOff, hint: 'Not in stock' },
  ]

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn(cardClass, 'min-w-0 p-3 sm:p-4')}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-[var(--fg-muted)]">In stock</p>
              <p className="mt-1 font-display text-lg font-semibold sm:text-xl">{u.physical}</p>
            </div>
            <p className="text-[11px] text-[var(--fg-muted)]">Physical units, sellable or not</p>
          </div>
          <div className="mt-3">
            <SellableBar sellable={u.sellable} nonSellable={u.nonSellable} />
          </div>
        </div>
        <StatCard
          label="Stock value"
          value={formatCurrency(summary.value.total)}
          hint={
            summary.value.uncostedUnits > 0 ? (
              <span className="text-[var(--warning)]">No cost · {summary.value.uncostedUnits} units</span>
            ) : undefined
          }
        />
        <StatCard
          label="Low stock"
          value={summary.lowStockProducts}
          hint={lowActive ? 'Filter on' : 'Tap to filter'}
          onClick={onLowStock}
          active={lowActive}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c, i) => (
          <StatCard key={`${i}-${c.label}`} label={c.label} value={c.value} hint={c.hint} />
        ))}
      </div>
    </div>
  )
}
