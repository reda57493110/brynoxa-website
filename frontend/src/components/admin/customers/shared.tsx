import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { TYPE_LABELS, chipClass, money, presetPeriod, type Period } from './utils'
import { cn } from '@/lib/cn'
import type { CustomerAccountStatus, CustomerType, WholesaleStatus } from '@/types'

export const cardClass = 'rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]'

const STATUS_META: Record<CustomerAccountStatus, { label: string; variant: BadgeVariant }> = {
  active: { label: 'Active', variant: 'success' },
  disabled: { label: 'Disabled', variant: 'danger' },
  unverified: { label: 'Unverified', variant: 'warning' },
  'wholesale-pending': { label: 'Wholesale pending', variant: 'warning' },
}

const WHOLESALE_META: Record<WholesaleStatus, { label: string; variant: BadgeVariant }> = {
  none: { label: 'Not applied', variant: 'muted' },
  pending: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
}

export function TypeBadge({ type, tierName }: { type?: CustomerType; tierName?: string }) {
  const t = type || 'retail'
  return (
    <Badge variant={t === 'retail' ? 'muted' : 'brand'}>
      {TYPE_LABELS[t]}
      {tierName ? ` · ${tierName}` : ''}
    </Badge>
  )
}

export function StatusBadge({ status }: { status: CustomerAccountStatus }) {
  const meta = STATUS_META[status] ?? { label: status, variant: 'default' as BadgeVariant }
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

export function WholesaleStatusBadge({ status }: { status: WholesaleStatus }) {
  const meta = WHOLESALE_META[status] ?? WHOLESALE_META.none
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

/** Profit value or the "cost data needed" state. Never estimates profit. */
export function ProfitText({
  value,
  missing,
  className,
  format = money,
}: {
  value: number | null
  missing: number
  className?: string
  format?: (v: number | null) => string
}) {
  if (value === null) {
    return (
      <span className={cn('text-xs text-[var(--warning)]', className)}>
        {missing > 0 ? `No cost · ${missing} order${missing === 1 ? '' : 's'}` : '—'}
      </span>
    )
  }
  return <span className={className}>{format(value)}</span>
}

export function StatCard({
  label,
  value,
  hint,
  onClick,
  active,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  onClick?: () => void
  active?: boolean
}) {
  const body = (
    <>
      <p className="text-xs text-[var(--fg-muted)]">{label}</p>
      <div className="mt-1 font-display text-lg font-semibold break-words sm:text-xl">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-[var(--fg-muted)]">{hint}</div> : null}
    </>
  )
  const cls = cn(cardClass, 'min-w-0 p-3 text-left sm:p-4', active && 'border-[var(--brand)]')
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(cls, 'transition hover:border-[var(--brand)] ring-brand')}>
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

export function Section({
  title,
  actions,
  children,
  className,
}: {
  title: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn(cardClass, 'min-w-0 p-4 sm:p-5', className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  )
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 py-1.5 text-sm">
      <dt className="shrink-0 text-[var(--fg-muted)]">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  )
}

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const presets: { id: 'all' | '30d' | 'year'; label: string }[] = [
    { id: 'all', label: 'All time' },
    { id: '30d', label: 'Last 30 days' },
    { id: 'year', label: 'This year' },
  ]
  const isActive = (id: 'all' | '30d' | 'year') => {
    const p = presetPeriod(id)
    return p.from === value.from && p.to === value.to
  }
  const dateCls =
    'h-9 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--fg)] outline-none ring-brand'
  return (
    <div className={cn(cardClass, 'flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4')}>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Period presets">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={isActive(p.id)}
            className={chipClass(isActive(p.id))}
            onClick={() => onChange(presetPeriod(p.id))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:items-end">
        <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--fg-muted)]">
          From
          <input
            type="date"
            className={dateCls}
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--fg-muted)]">
          To
          <input
            type="date"
            className={dateCls}
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </label>
      </div>
      <p className="text-xs text-[var(--fg-muted)] sm:ml-auto sm:self-center">
        {value.from || value.to
          ? `Selected period: ${value.from || 'start'} → ${value.to || 'today'}`
          : 'Showing lifetime figures'}
      </p>
    </div>
  )
}

export function CalculationNote() {
  return (
    <details className={cn(cardClass, 'p-4 text-sm')}>
      <summary className="cursor-pointer font-medium">How these numbers are calculated</summary>
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[var(--fg-muted)]">
        <li>
          <strong className="text-[var(--fg)]">Completed sale</strong> = delivered order not fully refunded.
          Cancelled orders never count.
        </li>
        <li>
          <strong className="text-[var(--fg)]">Net sales</strong> = gross sales − wholesale discounts − coupons −
          refunds (shipping excluded).
        </li>
        <li>
          <strong className="text-[var(--fg)]">Gross profit</strong> = net sales − cost of goods (only shown when
          every completed order has cost data).
        </li>
        <li>
          <strong className="text-[var(--fg)]">Margin</strong> = gross profit ÷ net sales.
        </li>
        <li>
          <strong className="text-[var(--fg)]">Amount paid</strong> = delivered totals + deposits received −
          refunds.
        </li>
        <li>
          <strong className="text-[var(--fg)]">To collect</strong> = open orders&apos; total − deposits already
          received.
        </li>
      </ul>
    </details>
  )
}
