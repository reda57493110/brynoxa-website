import { useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { SalesAnalytics } from '@/types'

export type SalesMetric = 'revenue' | 'orders'

/** "2026-10-07" → Date at noon UTC, so formatting never shifts the calendar day. */
const asDate = (day: string) => new Date(`${day}T12:00:00Z`)
const fmt = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(asDate(day))

export const dayLabel = (day: string) => fmt(day, { day: 'numeric', month: 'short' })

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

/**
 * Daily bars for the selected period (every day present, zero days included).
 * Hover or focus a bar for the date, revenue, sales and orders placed.
 */
export function SalesChart({ series, metric }: { series: SalesAnalytics['series']; metric: SalesMetric }) {
  const [active, setActive] = useState<number | null>(null)
  const value = (d: SalesAnalytics['series'][number]) => (metric === 'revenue' ? d.revenue : d.orders)
  const max = Math.max(0, ...series.map(value))
  const top = max > 0 ? max : 1
  const n = series.length
  // Keep date labels readable: every day up to 14, then spaced out
  const labelEvery = n <= 14 ? 1 : n <= 31 ? 5 : 15
  const point = active !== null ? series[active] : null

  return (
    <div className="relative min-w-0 select-none">
      <div className="flex gap-2">
        {/* Y axis */}
        <div className="flex h-48 w-9 shrink-0 flex-col justify-between text-end text-[10px] tabular-nums text-[var(--fg-muted)] sm:w-11">
          <span>{metric === 'revenue' ? compact(max) : max}</span>
          <span>{max > 0 ? (metric === 'revenue' ? compact(max / 2) : Math.round(max / 2) === max / 2 ? max / 2 : '') : ''}</span>
          <span>0</span>
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grid lines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-48" aria-hidden>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-[var(--border)]" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--border)]" />
            <div className="absolute inset-x-0 bottom-0 border-t border-[var(--border)]" />
          </div>

          {/* Bars: fixed-height track so percentage heights resolve */}
          <div className="relative flex h-48 items-end gap-px sm:gap-1" onMouseLeave={() => setActive(null)}>
            {series.map((d, i) => {
              const v = value(d)
              const pct = v > 0 ? Math.max(2, (v / top) * 100) : 0
              return (
                <button
                  key={d.date}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${fmt(d.date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${formatCurrency(d.revenue)} revenue, ${d.sales} sales, ${d.orders} orders placed`}
                  className="group flex h-full min-w-0 flex-1 items-end justify-center rounded-t outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                >
                  {v > 0 ? (
                    <span
                      className={cn(
                        'w-full max-w-10 rounded-t-md transition',
                        active === i ? 'bg-[var(--brand)]' : 'bg-[var(--brand)]/70 group-hover:bg-[var(--brand)]'
                      )}
                      style={{ height: `${pct}%` }}
                    />
                  ) : (
                    // Zero day: a small stub so the day is still visible
                    <span className="h-0.5 w-full max-w-10 rounded bg-[var(--border)]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* X axis */}
          <div className="mt-1.5 flex gap-px sm:gap-1" aria-hidden>
            {series.map((d, i) => (
              <span key={d.date} className="min-w-0 flex-1 text-center text-[9px] leading-tight text-[var(--fg-muted)] sm:text-[10px]">
                {i % labelEvery === 0 || i === n - 1 ? (
                  <span className={cn('block truncate', n > 7 && n <= 14 && i % 2 === 1 && 'max-sm:invisible')}>{dayLabel(d.date)}</span>
                ) : (
                  ' '
                )}
              </span>
            ))}
          </div>

          {/* Tooltip */}
          {point && active !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 text-xs shadow-lg"
              style={{
                left: `${((active + 0.5) / n) * 100}%`,
                transform: `translateX(${active < n * 0.2 ? '0%' : active > n * 0.8 ? '-100%' : '-50%'})`,
              }}
            >
              <p className="font-semibold">{fmt(point.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <dl className="mt-1 space-y-0.5">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--fg-muted)]">Revenue</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(point.revenue)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--fg-muted)]">Sales (delivered)</dt>
                  <dd className="tabular-nums">{point.sales}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--fg-muted)]">Orders placed</dt>
                  <dd className="tabular-nums">{point.orders}</dd>
                </div>
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
