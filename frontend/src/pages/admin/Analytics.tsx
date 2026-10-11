import { useState } from 'react'
import { orderStatusLabel } from '@/lib/orderStatus'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { Panel } from '@/components/admin/Panel'
import { SalesChart, type SalesMetric } from '@/components/admin/SalesChart'
import { BarList, Change, Kpi, SalesStats, kpiGridClass } from '@/components/admin/analytics/Kit'
import { dayLabel } from '@/lib/salesBuckets'
import { formatCurrency, formatCurrencyRounded } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { AnalyticsReport, SalesRange } from '@/types'

const RANGES: { value: SalesRange; label: string }[] = [
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
  { value: 90, label: '90d' },
  { value: 180, label: '6m' },
  { value: 365, label: '1y' },
]

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-[var(--warning)]',
  no_answer: 'bg-amber-600',
  confirmed: 'bg-[var(--brand)]',
  shipped: 'bg-[color-mix(in_srgb,var(--brand)_60%,var(--success))]',
  delivery_failed: 'bg-orange-500',
  rescheduled: 'bg-sky-500',
  delivered: 'bg-[var(--success)]',
  return_requested: 'bg-violet-400',
  return_in_transit: 'bg-violet-500',
  partially_returned: 'bg-violet-600',
  returned: 'bg-violet-700',
  cancelled: 'bg-[var(--danger)]',
}
/** Always listed; the other statuses only when they have orders. */
const CORE_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

const CONDITION_LABEL: Record<string, string> = { new: 'New', refurbished: 'Refurbished', used: 'Used' }

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase())

/** Daily figures as a CSV file (opens in Excel / Google Sheets). */
function downloadCsv(report: AnalyticsReport) {
  const rows = [
    ['Date', 'Revenue (DH)', 'Delivered sales', 'Orders placed', 'Orders value (DH)'],
    ...report.series.map((d) => [d.date, d.revenue, d.sales, d.orders, d.orderValue]),
  ]
  const csv = rows.map((r) => r.join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `brynoxa-sales-${report.from}-to-${report.to}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function Loading() {
  return (
    <div className="space-y-4">
      <div className={kpiGridClass}>
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[6.5rem] rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

export function Analytics() {
  const [range, setRange] = useState<SalesRange>(30)
  const [metric, setMetric] = useState<SalesMetric>('revenue')

  const report = useQuery({
    queryKey: ['admin-dashboard', 'analytics', range],
    queryFn: async () => (await adminApi.analytics(range)).data.data,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

  const r = report.data
  const t = r?.totals
  const p = r?.previous
  const placed = r ? r.status.reduce((a, s) => a + s.orders, 0) : 0
  const itemSales = r ? r.categories.reduce((a, c) => a + c.revenue, 0) : 0
  const bestTotal = r ? r.topProducts.reduce((a, b) => a + b.revenue, 0) : 0
  const conditionTotal = r ? r.conditions.reduce((a, c) => a + c.revenue, 0) : 0
  const channelTotal = r ? r.channels.reduce((a, c) => a + c.revenue, 0) : 0
  const weekdayMax = r ? Math.max(1, ...r.weekdays.map((w) => w.orders)) : 1
  const busiest = r?.weekdays.reduce((b, w) => (w.orders > b.orders ? w : b), r.weekdays[0])

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader
        title="Analytics"
        description={r ? `${dayLabel(r.from)} – ${dayLabel(r.to)} · Morocco time · vs the ${range} days before` : 'Sales, orders and customers'}
        actions={
          <>
            <div role="radiogroup" aria-label="Period" className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5">
              {RANGES.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={range === o.value}
                  onClick={() => setRange(o.value)}
                  className={cn(
                    'h-8 rounded-full px-3 text-sm font-medium transition',
                    range === o.value ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!r} onClick={() => r && downloadCsv(r)}>
              Export CSV
            </Button>
          </>
        }
      />

      {report.isError && !r ? (
        <QueryErrorState onRetry={() => report.refetch()} />
      ) : !r || !t || !p ? (
        <Loading />
      ) : (
        <div className={cn('space-y-3 sm:space-y-6', report.isFetching && 'opacity-60 transition-opacity')}>
          {/* Money */}
          <div className={kpiGridClass}>
            <Kpi label="Revenue" value={formatCurrencyRounded(t.revenue)} hint={<Change now={t.revenue} before={p.revenue} days={range} money />} icon="banknote" />
            <Kpi
              label="Delivered sales"
              value={t.completedOrders}
              hint={<Change now={t.completedOrders} before={p.completedOrders} days={range} />}
              icon="package-check"
            />
            <Kpi
              label="Average sale"
              value={t.avgOrderValue !== null ? formatCurrencyRounded(t.avgOrderValue) : '—'}
              hint={
                t.avgOrderValue !== null ? (
                  <Change now={t.avgOrderValue} before={p.avgOrderValue} days={range} money />
                ) : (
                  <span className="text-[var(--fg-muted)]">No delivered orders</span>
                )
              }
              icon="tag"
            />
            {r.profitVisible ? (
              <Kpi
                label="Gross profit"
                value={t.profit !== null ? formatCurrencyRounded(t.profit) : '—'}
                hint={
                  t.profit !== null ? (
                    <span className="text-[var(--fg-muted)]">{t.revenue > 0 ? `${pct(t.profit, t.revenue)}% margin` : 'No revenue yet'}</span>
                  ) : (
                    <span className="text-[var(--warning)]">
                      {t.salesMissingCost} sale{t.salesMissingCost === 1 ? '' : 's'} without a cost price
                    </span>
                  )
                }
                icon="layers"
              />
            ) : (
              <Kpi label="Orders value" value={formatCurrencyRounded(t.orderValue)} hint={<span className="text-[var(--fg-muted)]">All orders placed</span>} icon="cart" />
            )}
          </div>

          {/* Orders and customers */}
          <div className={kpiGridClass}>
            <Kpi label="Orders placed" value={t.orders} hint={<Change now={t.orders} before={p.orders} days={range} />} icon="cart" to="/admin/orders" />
            <Kpi
              label="Cancellation rate"
              value={r.cancellationRate !== null ? `${r.cancellationRate}%` : '—'}
              hint={<span className="text-[var(--fg-muted)]">{r.status.find((s) => s.status === 'cancelled')?.orders ?? 0} cancelled</span>}
              icon="close"
              tone={r.cancellationRate && r.cancellationRate >= 20 ? 'warning' : undefined}
            />
            <Kpi
              label="Refunds"
              value={formatCurrencyRounded(r.refunds.amount)}
              hint={<span className="text-[var(--fg-muted)]">{r.refunds.orders} order{r.refunds.orders === 1 ? '' : 's'}</span>}
              icon="refresh"
              tone={r.refunds.amount > 0 ? 'warning' : undefined}
            />
            <Kpi
              label="New accounts"
              value={r.customers.newAccounts}
              hint={<Change now={r.customers.newAccounts} before={r.customers.newAccountsPrev} days={range} />}
              icon="users"
              to="/admin/customers"
            />
          </div>

          {/* Trend */}
          <Panel compact
            title="Sales trend"
            description={metric === 'revenue' ? `${formatCurrency(t.revenue)} from ${t.completedOrders} delivered orders` : `${t.orders} orders placed`}
            actions={
              <div role="radiogroup" aria-label="Chart" className="inline-flex rounded-full border border-[var(--border)] p-0.5 text-xs">
                {(['revenue', 'orders'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={metric === m}
                    onClick={() => setMetric(m)}
                    className={cn(
                      'h-7 rounded-full px-3 font-medium capitalize transition',
                      metric === m ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            }
          >
            <SalesChart series={r.series} metric={metric} />
            <SalesStats analytics={r} metric={metric} />
          </Panel>

          {/* Products */}
          <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2">
            <Panel compact title="Sales by category" description="Delivered items, before coupons and refunds.">
              <BarList
                rows={r.categories.map((c) => ({
                  key: c.categoryId ?? c.name,
                  label: c.name,
                  value: c.revenue,
                  display: formatCurrency(c.revenue),
                  sub: `${c.units} units · ${pct(c.revenue, itemSales)}%`,
                }))}
                empty="No delivered sales in this period."
              />
            </Panel>

            <Panel compact title="Best sellers" description="Top 10 by units delivered.">
              {r.topProducts.length ? (
                <ol className="-my-1 divide-y divide-[var(--border)]">
                  {r.topProducts.map((tp, i) => {
                    const row = (
                      <>
                        <span className="w-5 shrink-0 text-xs tabular-nums text-[var(--fg-muted)]">{i + 1}</span>
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                          {tp.image ? <SafeImage src={optimizedImageUrl(tp.image, 96)} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : null}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{tp.name}</span>
                          <span className="block text-[11px] text-[var(--fg-muted)] sm:hidden">{tp.units} sold</span>
                        </span>
                        <span className="hidden w-14 shrink-0 text-end text-xs tabular-nums text-[var(--fg-muted)] sm:block">{tp.units} sold</span>
                        <span className="shrink-0 text-end text-sm font-medium tabular-nums sm:w-24">{formatCurrency(tp.revenue)}</span>
                        <span className="hidden w-10 shrink-0 text-end text-[11px] tabular-nums text-[var(--fg-muted)] sm:block">
                          {pct(tp.revenue, bestTotal)}%
                        </span>
                      </>
                    )
                    return (
                      <li key={tp.productId}>
                        {tp.exists ? (
                          <Link to={`/admin/inventory/products/${tp.productId}`} className="flex min-w-0 items-center gap-2.5 py-2 hover:text-[var(--brand-text)]">
                            {row}
                          </Link>
                        ) : (
                          <div className="flex min-w-0 items-center gap-2.5 py-2">{row}</div>
                        )}
                      </li>
                    )
                  })}
                </ol>
              ) : (
                <p className="text-sm text-[var(--fg-muted)]">No delivered sales in this period.</p>
              )}
            </Panel>
          </div>

          {/* Orders mix */}
          <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-3">
            <Panel compact title="Order status" description={`${placed} order${placed === 1 ? '' : 's'} placed in the period`}>
              {placed ? (
                <>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--bg-muted)]" aria-hidden>
                    {r.status.map((s) =>
                      s.orders ? <span key={s.status} className={STATUS_COLOR[s.status]} style={{ width: `${pct(s.orders, placed)}%` }} /> : null
                    )}
                  </div>
                  <ul className="space-y-1.5 text-sm">
                    {r.status.filter((s) => s.orders > 0 || CORE_STATUSES.includes(s.status)).map((s) => (
                      <li key={s.status}>
                        <Link to={`/admin/orders?status=${s.status}`} className="flex items-center gap-2 rounded-lg hover:text-[var(--brand-text)]">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_COLOR[s.status])} />
                          <span className="flex-1">{orderStatusLabel(s.status)}</span>
                          <span className="tabular-nums">{s.orders}</span>
                          <span className="w-10 text-end text-xs tabular-nums text-[var(--fg-muted)]">{pct(s.orders, placed)}%</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-[var(--fg-muted)]">No orders in this period.</p>
              )}
            </Panel>

            <Panel compact title="By condition" description="Delivered items.">
              <BarList
                rows={r.conditions
                  .slice()
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((c) => ({
                    key: c.condition,
                    label: CONDITION_LABEL[c.condition] ?? c.condition,
                    value: c.revenue,
                    display: formatCurrency(c.revenue),
                    sub: `${c.units} units · ${pct(c.revenue, conditionTotal)}%`,
                  }))}
              />
            </Panel>

            <Panel compact title="Retail vs wholesale" description="Delivered sales, net of coupons and refunds.">
              <BarList
                rows={r.channels
                  .slice()
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((c) => ({
                    key: c.channel,
                    label: c.channel === 'wholesale' ? 'Wholesale' : 'Retail',
                    value: c.revenue,
                    display: formatCurrency(c.revenue),
                    sub: `${c.sales} sales · ${pct(c.revenue, channelTotal)}%`,
                  }))}
              />
            </Panel>
          </div>

          {/* Where and when */}
          <div className="grid min-w-0 gap-3 sm:gap-4 lg:grid-cols-2">
            <Panel compact title="Top cities" description="Orders placed (not cancelled) by delivery city.">
              <BarList
                rows={r.cities.map((c) => ({
                  key: c.city,
                  label: titleCase(c.city),
                  value: c.orders,
                  display: `${c.orders} order${c.orders === 1 ? '' : 's'}`,
                  sub: formatCurrency(c.value),
                }))}
              />
            </Panel>

            <Panel compact
              title="Orders by weekday"
              description={busiest && busiest.orders > 0 ? `Busiest day: ${busiest.day}` : 'Orders placed (not cancelled), Morocco time.'}
            >
              <div className="flex h-32 items-end gap-1.5 sm:h-36 sm:gap-2">
                {r.weekdays.map((w) => (
                  <div key={w.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${w.day}: ${w.orders} orders · ${formatCurrency(w.value)}`}>
                    <span className="text-[10px] tabular-nums text-[var(--fg-muted)]">{w.orders || ''}</span>
                    <span
                      className={cn('w-full max-w-10 rounded-t-md', w.orders ? 'bg-[var(--brand)]' : 'bg-[var(--border)]')}
                      style={{ height: w.orders ? `${Math.max(4, (w.orders / weekdayMax) * 100)}%` : '2px' }}
                    />
                    <span className="text-[11px] text-[var(--fg-muted)]">{w.day}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          {/* Customers */}
          <Panel compact title="Customers" description="People who placed an order in the period.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {[
                { label: 'Buyers', value: r.customers.buyers },
                { label: 'First-time', value: r.customers.firstTime, sub: `${pct(r.customers.firstTime, r.customers.buyers)}%` },
                { label: 'Returning', value: r.customers.returning, sub: `${pct(r.customers.returning, r.customers.buyers)}%` },
                { label: 'Guest checkouts', value: r.customers.guests, sub: `${pct(r.customers.guests, r.customers.buyers)}%` },
              ].map((c) => (
                <div key={c.label}>
                  <p className="text-xs text-[var(--fg-muted)]">{c.label}</p>
                  <p className="font-display text-lg font-semibold tabular-nums sm:text-xl">
                    {c.value}
                    {c.sub && r.customers.buyers ? <span className="ms-1.5 text-xs font-normal text-[var(--fg-muted)]">{c.sub}</span> : null}
                  </p>
                </div>
              ))}
            </div>
            {r.customers.buyers ? (
              <div className="flex h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]" aria-hidden>
                <span className="bg-[var(--brand)]" style={{ width: `${pct(r.customers.firstTime, r.customers.buyers)}%` }} />
                <span className="bg-[var(--success)]" style={{ width: `${pct(r.customers.returning, r.customers.buyers)}%` }} />
              </div>
            ) : null}
            <Link to="/admin/customers" className="inline-flex items-center gap-1 text-sm font-medium text-[var(--brand-text)] hover:underline">
              Customer details <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
            </Link>
          </Panel>

          <p className="text-[11px] text-[var(--fg-muted)]">
            Revenue = delivered orders (paid on delivery) minus coupons and refunds, without shipping. Orders are counted on the
            day they were placed.
          </p>
        </div>
      )}
    </div>
  )
}
