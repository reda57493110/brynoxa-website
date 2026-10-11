import { useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { SalesAnalytics } from '@/types'
import { bucketLabel, dayLabel, fmtDay as fmt, toBuckets, type SalesBucket } from '@/lib/salesBuckets'

export type SalesMetric = 'revenue' | 'orders'

type Day = SalesAnalytics['series'][number]

function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return String(Math.round(n))
}

/** A round axis maximum (1, 2, 2.5, 5 × 10ⁿ) at or above the highest value. */
function niceMax(v: number) {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

/**
 * Sales bars for the selected period: every day (or week) present, zero ones included, with a
 * dashed average line. Hover or focus a bar for its figures.
 */
export function SalesChart({ series, metric }: { series: Day[]; metric: SalesMetric }) {
  const [active, setActive] = useState<number | null>(null)
  const buckets = toBuckets(series)
  const weekly = buckets.length !== series.length
  const value = (b: SalesBucket) => (metric === 'revenue' ? b.revenue : b.orders)
  const values = buckets.map(value)
  const top = niceMax(Math.max(0, ...values))
  const avg = values.reduce((a, v) => a + v, 0) / (values.length || 1)
  const n = buckets.length
  // Spread about 6–8 labels across the axis, always including the last bar
  const labelEvery = Math.max(1, Math.ceil(n / 7))
  const point = active !== null ? buckets[active] : null
  const axis = (v: number) => (metric === 'revenue' ? compact(v) : Number.isInteger(v) ? String(v) : '')

  return (
    <div className="relative min-w-0 select-none">
      <div className="flex gap-2">
        {/* Y axis */}
        <div className="flex h-40 w-8 shrink-0 flex-col justify-between text-end text-[10px] tabular-nums text-[var(--fg-muted)] sm:h-52 sm:w-12">
          <span className="-translate-y-1/2">{axis(top)}</span>
          <span>{axis(top / 2)}</span>
          <span className="translate-y-1/2">0</span>
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grid */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 sm:h-52" aria-hidden>
            <div className="absolute inset-x-0 top-0 border-t border-dashed border-[var(--border)]" />
            <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--border)]" />
            <div className="absolute inset-x-0 bottom-0 border-t border-[var(--border)]" />
            {avg > 0 ? (
              <div className="absolute inset-x-0 border-t border-dashed border-[var(--warning)]/70" style={{ bottom: `${(avg / top) * 100}%` }} />
            ) : null}
          </div>

          {/* Bars: fixed-height track so percentage heights resolve */}
          <div className={cn('relative flex h-40 items-end sm:h-52', n > 40 ? 'gap-px' : 'gap-0.5 sm:gap-1.5')} onMouseLeave={() => setActive(null)}>
            {buckets.map((b, i) => {
              const v = value(b)
              const pct = v > 0 ? Math.max(2, (v / top) * 100) : 0
              return (
                <button
                  key={b.from}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  aria-label={`${bucketLabel(b)}: ${formatCurrency(b.revenue)} revenue, ${b.sales} sales, ${b.orders} orders placed`}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-t outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
                >
                  {active === i ? <span className="absolute inset-0 rounded-md bg-[var(--fg)]/[0.04]" aria-hidden /> : null}
                  {v > 0 ? (
                    <span
                      className={cn(
                        'relative w-full max-w-12 rounded-t-md bg-gradient-to-t transition',
                        active === i
                          ? 'from-[var(--brand)] to-[var(--brand)]'
                          : 'from-[color-mix(in_srgb,var(--brand)_55%,transparent)] to-[var(--brand)] group-hover:to-[var(--brand)]'
                      )}
                      style={{ height: `${pct}%` }}
                    />
                  ) : (
                    // Zero: a small stub so the day/week is still visible
                    <span className="relative h-0.5 w-full max-w-12 rounded bg-[var(--border)]" />
                  )}
                </button>
              )
            })}
          </div>

          {/* X axis: labels positioned over their bar, never squeezed into the bar's width */}
          <div className="relative mt-2 h-4" aria-hidden>
            {buckets.map((b, i) =>
              i % labelEvery === 0 || i === n - 1 ? (
                <span
                  key={b.from}
                  className={cn(
                    'absolute top-0 whitespace-nowrap text-[10px] text-[var(--fg-muted)]',
                    // Skip a label that would collide with the always-shown last one
                    i !== n - 1 && n - 1 - i < labelEvery * 0.6 && 'hidden',
                    // Phones: every other label (the first and last always stay)
                    i !== 0 && i !== n - 1 && (i / labelEvery) % 2 === 1 && 'max-sm:hidden'
                  )}
                  style={{
                    left: `${((i + 0.5) / n) * 100}%`,
                    transform: i === 0 ? 'translateX(-15%)' : i === n - 1 ? 'translateX(-85%)' : 'translateX(-50%)',
                  }}
                >
                  {dayLabel(b.from)}
                </span>
              ) : null
            )}
          </div>

          {/* Tooltip */}
          {point && active !== null ? (
            <div
              role="status"
              className="pointer-events-none absolute top-0 z-10 w-48 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 text-xs shadow-lg"
              style={{
                left: `${((active + 0.5) / n) * 100}%`,
                transform: `translateX(${active < n * 0.25 ? '0%' : active > n * 0.75 ? '-100%' : '-50%'})`,
              }}
            >
              <p className="font-semibold">
                {point.from === point.to ? fmt(point.from, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : `Week ${bucketLabel(point)}`}
              </p>
              <dl className="mt-1 space-y-0.5">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--fg-muted)]">Revenue</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(point.revenue)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--fg-muted)]">Delivered sales</dt>
                  <dd className="tabular-nums">{point.sales}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--fg-muted)]">Orders placed</dt>
                  <dd className="tabular-nums">{point.orders}</dd>
                </div>
                {point.sales > 0 ? (
                  <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-0.5">
                    <dt className="text-[var(--fg-muted)]">Average sale</dt>
                    <dd className="tabular-nums">{formatCurrency(point.revenue / point.sales)}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-[10px] text-[var(--fg-muted)]">
        {avg > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span className="w-3 border-t border-dashed border-[var(--warning)]" aria-hidden />
            Average {metric === 'revenue' ? `${compact(avg)} DH` : avg.toFixed(avg < 10 ? 1 : 0)}
            {weekly ? ' / week' : ' / day'}
          </span>
        ) : null}
        {weekly ? <span>One bar per week</span> : null}
      </div>
    </div>
  )
}
