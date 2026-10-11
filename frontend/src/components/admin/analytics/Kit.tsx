import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import type { SalesMetric } from '@/components/admin/SalesChart'
import { formatCurrency } from '@/lib/format'
import { dayLabel } from '@/lib/salesBuckets'
import { cn } from '@/lib/cn'
import type { SalesAnalytics } from '@/types'

export const analyticsCard = 'min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]'
const card = analyticsCard

/** "▲ 12% vs 1,200 DH prev. 14 days" — or a plain note when there is nothing to compare with. */
export function Change({ now, before, days, money }: { now: number | null; before: number | null; days: number; money?: boolean }) {
  if (now === null || before === null || (now === 0 && before === 0)) {
    return <span className="text-[var(--fg-muted)]">Nothing in the previous {days} days</span>
  }
  if (before === 0) return <span className="text-[var(--success)]">New vs previous {days} days</span>
  const pct = ((now - before) / Math.abs(before)) * 100
  const up = pct >= 0
  return (
    <span className={cn(Math.abs(pct) < 0.5 ? 'text-[var(--fg-muted)]' : up ? 'text-[var(--success)]' : 'text-[var(--danger)]')}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%{' '}
      <span className="text-[var(--fg-muted)]">
        vs {money ? formatCurrency(before) : before} prev. {days} days
      </span>
    </span>
  )
}

export function Kpi({
  label,
  value,
  hint,
  icon,
  to,
  tone,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: SiteIconName
  to?: string
  tone?: 'warning' | 'danger'
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs text-[var(--fg-muted)] sm:text-sm">{label}</p>
        <SiteIcon
          name={icon}
          size={18}
          className={cn(
            'shrink-0',
            tone === 'danger' ? 'text-[var(--danger)]' : tone === 'warning' ? 'text-[var(--warning)]' : 'text-[var(--brand)]'
          )}
        />
      </div>
      <div className="mt-1.5 truncate font-display text-lg font-semibold tabular-nums sm:text-2xl">{value}</div>
      {hint ? <div className="mt-1 truncate text-[11px] sm:text-xs">{hint}</div> : null}
    </>
  )
  const cls = cn(card, 'block p-3 sm:p-4')
  return to ? (
    <Link to={to} className={cn(cls, 'transition hover:border-[var(--brand)]')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Key figures under the chart, computed from the same daily series. */
export function SalesStats({ analytics, metric }: { analytics: SalesAnalytics; metric: SalesMetric }) {
  const { series, totals: t, range } = analytics
  const v = (d: SalesAnalytics['series'][number]) => (metric === 'revenue' ? d.revenue : d.orders)
  const best = series.reduce<SalesAnalytics['series'][number] | null>((b, d) => (v(d) > 0 && (!b || v(d) > v(b)) ? d : b), null)
  const activeDays = series.filter((d) => v(d) > 0).length
  const total = metric === 'revenue' ? t.revenue : t.orders
  const perDay = total / (series.length || 1)
  const deliveryRate = t.orders > 0 ? Math.round((t.completedOrders / t.orders) * 100) : null
  const money = (n: number) => formatCurrency(Math.round(n * 100) / 100)

  const stats: { label: string; value: string; hint?: string }[] = [
    {
      label: metric === 'revenue' ? 'Average per day' : 'Orders per day',
      value: metric === 'revenue' ? money(perDay) : perDay.toFixed(perDay < 10 ? 1 : 0),
      hint: `over ${range} days`,
    },
    {
      label: 'Best day',
      value: best ? (metric === 'revenue' ? money(best.revenue) : String(best.orders)) : '—',
      hint: best ? dayLabel(best.date) : 'No sales yet',
    },
    {
      label: metric === 'revenue' ? 'Days with sales' : 'Days with orders',
      value: `${activeDays}/${series.length}`,
      hint: `${Math.round((activeDays / (series.length || 1)) * 100)}% of days`,
    },
    {
      label: 'Delivered',
      value: deliveryRate === null ? '—' : `${deliveryRate}%`,
      hint: `${t.completedOrders} of ${t.orders} orders placed`,
    },
  ]

  return (
    <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="min-w-0 bg-[var(--bg-elevated)] px-3 py-2.5">
          <dt className="truncate text-[11px] text-[var(--fg-muted)]">{s.label}</dt>
          <dd className="mt-0.5 truncate font-display text-base font-semibold tabular-nums">{s.value}</dd>
          {s.hint ? <dd className="truncate text-[10px] text-[var(--fg-muted)]">{s.hint}</dd> : null}
        </div>
      ))}
    </dl>
  )
}

export function SectionTitle({ title, link }: { title: string; link?: { to: string; label: string } }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="font-display text-sm font-semibold sm:text-base">{title}</h2>
      {link ? (
        <Link to={link.to} className="shrink-0 text-sm text-[var(--brand-text)] hover:underline">
          {link.label}
        </Link>
      ) : null}
    </div>
  )
}


/** Ranked horizontal bars: label, value and a bar sized against the largest row. */
export function BarList({
  rows,
  empty = 'No data in this period.',
}: {
  rows: { key: string; label: ReactNode; value: number; display: string; sub?: string; to?: string }[]
  empty?: string
}) {
  if (!rows.length) return <p className="text-sm text-[var(--fg-muted)]">{empty}</p>
  const max = Math.max(...rows.map((r) => r.value), 1)
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{r.display}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
              </span>
              {r.sub ? <span className="w-20 shrink-0 text-end text-[10px] tabular-nums text-[var(--fg-muted)]">{r.sub}</span> : null}
            </div>
          </>
        )
        return (
          <li key={r.key}>
            {r.to ? (
              <Link to={r.to} className="block rounded-lg hover:opacity-80">
                {body}
              </Link>
            ) : (
              body
            )}
          </li>
        )
      })}
    </ul>
  )
}
