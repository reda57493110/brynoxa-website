import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { TYPE_LABELS, chipClass, money, presetPeriod, type Period } from './utils'
import { cn } from '@/lib/cn'
import { at } from '@/i18n/admin'
import { useAdminT } from '@/store/adminLangStore'
import type { CustomerAccountStatus, CustomerType, WholesaleStatus } from '@/types'

export const cardClass = 'rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]'

// Labels are read when shown (getters), so they follow the admin language
const STATUS_META: Record<CustomerAccountStatus, { label: string; variant: BadgeVariant }> = {
  active: { get label() { return at('cust.st.active') }, variant: 'success' },
  disabled: { get label() { return at('cust.st.disabled') }, variant: 'danger' },
  unverified: { get label() { return at('cust.st.unverified') }, variant: 'warning' },
  'wholesale-pending': { get label() { return at('cust.st.wholesale-pending') }, variant: 'warning' },
}

const WHOLESALE_META: Record<WholesaleStatus, { label: string; variant: BadgeVariant }> = {
  none: { get label() { return at('cust.ws.none') }, variant: 'muted' },
  pending: { get label() { return at('cust.ws.pending') }, variant: 'warning' },
  approved: { get label() { return at('cust.ws.approved') }, variant: 'success' },
  rejected: { get label() { return at('cust.ws.rejected') }, variant: 'danger' },
}

/** Ordered without an account (often with the phone only, no email) */
export function GuestBadge() {
  const tr = useAdminT()
  return <Badge variant="muted">{tr('cust.guest')}</Badge>
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
        {missing > 0 ? (missing === 1 ? at('cust.noCostOne') : at('cust.noCost', { count: missing })) : '—'}
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
      <p className="text-[11px] text-[var(--fg-muted)] sm:text-xs">{label}</p>
      <div className="mt-0.5 font-display text-base font-semibold break-words sm:mt-1 sm:text-xl">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-[var(--fg-muted)]">{hint}</div> : null}
    </>
  )
  const cls = cn(cardClass, 'min-w-0 rounded-xl p-2.5 text-start sm:rounded-2xl sm:p-4', active && 'border-[var(--brand)]')
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
      <dd className="min-w-0 text-end break-words">{children}</dd>
    </div>
  )
}

export function PeriodFilter({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const tr = useAdminT()
  const presets: { id: 'all' | '30d' | 'year'; label: string }[] = [
    { id: 'all', label: tr('cust.allTime') },
    { id: '30d', label: tr('cust.last30') },
    { id: 'year', label: tr('cust.thisYear') },
  ]
  const isActive = (id: 'all' | '30d' | 'year') => {
    const p = presetPeriod(id)
    return p.from === value.from && p.to === value.to
  }
  const dateCls =
    'h-9 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--fg)] outline-none ring-brand'
  return (
    <div className={cn(cardClass, 'flex min-w-0 flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-end sm:p-4')}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={tr('cust.periodAria')}>
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
          {tr('cust.from')}
          <input
            type="date"
            className={dateCls}
            value={value.from}
            max={value.to || undefined}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--fg-muted)]">
          {tr('cust.to')}
          <input
            type="date"
            className={dateCls}
            value={value.to}
            min={value.from || undefined}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </label>
      </div>
      <p className="text-xs text-[var(--fg-muted)] sm:ms-auto sm:self-center">
        {value.from || value.to
          ? tr('cust.selectedPeriod', { from: value.from || tr('cust.start'), to: value.to || tr('cust.today') })
          : tr('cust.lifetimeFigures')}
      </p>
    </div>
  )
}

export function CalculationNote() {
  const tr = useAdminT()
  const rows: [string, string][] = [
    [tr('cust.calc.completedSale'), tr('cust.calc.completedDef')],
    [tr('cust.netSales'), tr('cust.calc.netDef')],
    [tr('cust.grossProfit'), tr('cust.calc.profitDef')],
    [tr('cust.calc.margin'), tr('cust.calc.marginDef')],
    [tr('cust.calc.amountPaid'), tr('cust.calc.amountPaidDef')],
    [tr('cust.calc.toCollect'), tr('cust.calc.toCollectDef')],
  ]
  return (
    <details className={cn(cardClass, 'p-4 text-sm')}>
      <summary className="cursor-pointer font-medium">{tr('cust.howCalc')}</summary>
      <ul className="mt-3 list-disc space-y-1.5 ps-5 text-[var(--fg-muted)]">
        {rows.map(([term, def]) => (
          <li key={term}>
            <strong className="text-[var(--fg)]">{term}</strong> = {def}
          </li>
        ))}
      </ul>
    </details>
  )
}
