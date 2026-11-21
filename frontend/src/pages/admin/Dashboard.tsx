import { SiteIcon } from '@/components/ui/SiteIcon'
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { SafeImage } from '@/components/ui/SafeImage'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { SalesChart, type SalesMetric } from '@/components/admin/SalesChart'
import { Change, Kpi, SalesStats, SectionTitle, analyticsCard as card, kpiGridClass } from '@/components/admin/analytics/Kit'
import { dayLabel } from '@/lib/salesBuckets'
import { useAdminStats } from '@/hooks/useAdminStats'
import { ORDER_STATUSES, orderStatusLabel, orderStatusVariant } from '@/lib/admin'
import { formatCurrency, formatCurrencyRounded, formatDate } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { hasPermission, staffHomePath } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import { savedPlaceholder, useKeepSavedCopy } from '@/lib/savedCopy'
import { cn } from '@/lib/cn'
import { useAdminT } from '@/store/adminLangStore'
import type { AdminKey } from '@/i18n/admin'
import type { SalesRange, User } from '@/types'

const RANGES: SalesRange[] = [7, 14, 30, 90]

/** Same words as the order page (admin texts "pay.*") */
const PAYMENT_LABEL: Record<string, AdminKey> = { pending: 'pay.pending', paid: 'pay.paid', failed: 'pay.failed', refunded: 'pay.refunded' }

const PAYMENT_VARIANT: Record<string, BadgeVariant> = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'muted',
}

export function Dashboard() {
  const tr = useAdminT()
  const role = useAuthStore((s) => s.user?.role)
  const canDashboard = hasPermission(role, 'dashboard')
  const stats = useAdminStats()
  const [range, setRange] = useState<SalesRange>(14)
  const [metric, setMetric] = useState<SalesMetric>('revenue')

  const sales = useQuery({
    queryKey: ['admin-dashboard', 'sales', range],
    queryFn: async () => (await adminApi.dashboardSales(range)).data.data,
    enabled: canDashboard,
    staleTime: 60_000,
    refetchInterval: 90_000,
    // the previous period, or the last numbers seen on this device, while fresh ones load
    placeholderData: savedPlaceholder(`sales:${range}`),
  })
  useKeepSavedCopy(`sales:${range}`, sales.data, sales.isPlaceholderData)

  // What the shop really earned (product cost, courier, fees, expenses taken off)
  const canSeeProfit = hasPermission(role, 'reports')
  const net = useQuery({
    queryKey: ['admin-dashboard', 'net-profit', range],
    queryFn: async () => (await adminApi.profit.summary(range)).data.data,
    enabled: canDashboard && canSeeProfit,
    staleTime: 60_000,
    placeholderData: savedPlaceholder(`net:${range}`),
  })
  useKeepSavedCopy(`net:${range}`, net.data, net.isPlaceholderData)

  // Full dashboard is Owner-only; other roles go straight to their workspace
  if (!canDashboard) {
    return <Navigate to={staffHomePath(role)} replace />
  }

  const s = stats.data
  const a = sales.data
  const t = a?.totals
  const p = a?.previous

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <AdminHeader
          title={tr('dash.title')}
          description={a ? tr('dash.descRange', { from: dayLabel(a.from), to: dayLabel(a.to) }) : tr('dash.desc')}
        />
        <div
          role="radiogroup"
          aria-label={tr('dash.period')}
          className="inline-flex shrink-0 self-start rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] p-0.5 sm:self-auto"
        >
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'h-8 rounded-full px-3 text-sm font-medium transition',
                range === r ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              {tr('common.daysShort', { days: r })}
            </button>
          ))}
        </div>
      </div>

      {/* Sales KPIs for the selected period */}
      {sales.isError && !a ? (
        <QueryErrorState onRetry={() => sales.refetch()} />
      ) : (
        <div className={kpiGridClass}>
          {!t || !p ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[6.5rem] rounded-2xl" />)
          ) : (
            <>
              <Kpi
                label={tr('dash.revenue', { days: range })}
                value={formatCurrencyRounded(t.revenue)}
                hint={<Change now={t.revenue} before={p.revenue} days={range} money />}
                icon="banknote"
                to="/admin/analytics"
              />
              <Kpi
                label={tr('dash.orders', { days: range })}
                value={t.orders}
                hint={
                  <span className="text-[var(--fg-muted)]">
                    {tr('dash.ordersHint', { done: t.completedOrders, value: formatCurrencyRounded(t.orderValue) })}
                  </span>
                }
                icon="package"
                to="/admin/orders"
              />
              <Kpi
                label={tr('dash.avgSale')}
                value={t.avgOrderValue !== null ? formatCurrencyRounded(t.avgOrderValue) : '—'}
                hint={
                  t.avgOrderValue !== null ? (
                    <Change now={t.avgOrderValue} before={p.avgOrderValue} days={range} money />
                  ) : (
                    <span className="text-[var(--fg-muted)]">{tr('dash.noDelivered')}</span>
                  )
                }
                icon="tag"
              />
              {canSeeProfit ? (
                <Kpi
                  label={tr('dash.netProfit', { days: range })}
                  value={net.data ? formatCurrencyRounded(net.data.current.netProfit) : '—'}
                  hint={
                    !net.data ? (
                      <span className="text-[var(--fg-muted)]">{tr('dash.afterCosts')}</span>
                    ) : net.data.current.salesMissingCost > 0 ? (
                      <span className="text-[var(--warning)]">
                        {net.data.current.salesMissingCost === 1 ? tr('dash.missingCostOne') : tr('dash.missingCost', { count: net.data.current.salesMissingCost })}
                      </span>
                    ) : (
                      <Change now={net.data.current.netProfit} before={net.data.previous.netProfit} days={range} money />
                    )
                  }
                  icon="layers"
                  to="/admin/profit"
                />
              ) : (
                <Kpi
                  label={tr('dash.customers')}
                  value={s?.customerCount ?? '—'}
                  hint={<span className="text-[var(--fg-muted)]">{tr('dash.storeAccounts')}</span>}
                  icon="users"
                  to="/admin/customers"
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Store status */}
      <div className={kpiGridClass}>
        {!s ? (
          stats.isError ? (
            <div className="col-span-full">
              <QueryErrorState onRetry={() => stats.refetch()} />
            </div>
          ) : (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[6.5rem] rounded-2xl" />)
          )
        ) : (
          <>
            <Kpi
              label={tr('dash.pending')}
              value={s.pendingOrders}
              hint={<span className="text-[var(--fg-muted)]">{tr('dash.placedToday', { count: s.todayOrders })}</span>}
              icon="clock"
              to="/admin/orders?status=pending"
              tone={s.pendingOrders > 0 ? 'warning' : undefined}
            />
            <Kpi
              label={tr('dash.activeProducts')}
              value={s.activeProducts}
              hint={<span className="text-[var(--fg-muted)]">{tr('dash.ofCatalog', { count: s.productCount })}</span>}
              icon="boxes"
              to="/admin/products"
            />
            <Kpi
              label={tr('dash.lowStock')}
              value={s.lowStock}
              hint={<span className="text-[var(--fg-muted)]">{tr('dash.atAlert')}</span>}
              icon="alert"
              to="/admin/inventory?status=low"
              tone={s.lowStock > 0 ? 'warning' : undefined}
            />
            <Kpi
              label={tr('dash.outOfStock')}
              value={s.outOfStock}
              hint={<span className="text-[var(--fg-muted)]">{tr('dash.nothingLeft')}</span>}
              icon="package-open"
              to="/admin/inventory?status=out"
              tone={s.outOfStock > 0 ? 'danger' : undefined}
            />
          </>
        )}
      </div>

      {/* Sales chart + order pipeline */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <section className={cn(card, 'rounded-xl p-3 sm:rounded-2xl sm:p-5 lg:col-span-2')}>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-xs font-medium text-[var(--fg-muted)]">
                {tr('dash.sales', { range: a ? `${dayLabel(a.from)} – ${dayLabel(a.to)}` : tr('common.days', { days: range }) })}
              </h2>
              {t && p ? (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <p className="font-display text-xl font-semibold tabular-nums sm:text-2xl">
                    {metric === 'revenue' ? formatCurrencyRounded(t.revenue) : t.orders === 1 ? tr('dash.orderOne') : tr('dash.ordersCount', { count: t.orders })}
                  </p>
                  <span className="text-xs">
                    {metric === 'revenue' ? (
                      <Change now={t.revenue} before={p.revenue} days={range} money />
                    ) : (
                      <Change now={t.orders} before={p.orders} days={range} />
                    )}
                  </span>
                </div>
              ) : null}
            </div>
            <div role="radiogroup" aria-label={tr('dash.chart')} className="inline-flex rounded-full border border-[var(--border)] p-0.5 text-xs">
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
                  {tr(m === 'revenue' ? 'common.revenue' : 'common.ordersMetric')}
                </button>
              ))}
            </div>
          </div>
          <div className={cn('mt-4', sales.isFetching && a && 'opacity-60 transition-opacity')}>
            {a ? (
              <SalesChart series={a.series} metric={metric} />
            ) : sales.isError ? (
              <QueryErrorState onRetry={() => sales.refetch()} />
            ) : (
              <Skeleton className="h-56 rounded-xl" />
            )}
          </div>
          {a ? <SalesStats analytics={a} metric={metric} /> : null}
          <Link to="/admin/analytics" className="mt-3 inline-block text-sm font-medium text-[var(--brand-text)] hover:underline">
            {tr('dash.fullAnalytics')}
          </Link>
          <p className="mt-3 text-[11px] text-[var(--fg-muted)]">
            {tr('dash.revenueNote')}
          </p>
        </section>

        <section className={cn(card, 'rounded-xl p-3 sm:rounded-2xl sm:p-5')}>
          <SectionTitle title={tr('dash.pipeline')} link={{ to: '/admin/orders', label: tr('common.orders') }} />
          <ul className="mt-3 space-y-1">
            <li>
              <Link
                to="/admin/orders?status=attention"
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm font-medium hover:bg-[var(--bg-muted)]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <SiteIcon name="alert" size={14} className="text-[var(--warning)]" /> {tr('dash.attention')}
                </span>
                <span className="shrink-0 tabular-nums">{s ? s.attentionOrders ?? 0 : '—'}</span>
              </Link>
            </li>
            {ORDER_STATUSES.filter(
              (status) => ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status) || (s?.ordersByStatus?.[status] ?? 0) > 0
            ).map((status) => (
              <li key={status}>
                <Link
                  to={`/admin/orders?status=${status}`}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-[var(--bg-muted)]"
                >
                  <Badge variant={orderStatusVariant(status)}>{orderStatusLabel(status)}</Badge>
                  <span className="shrink-0 font-medium tabular-nums">{s ? s.ordersByStatus?.[status] || 0 : '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Recent orders + best sellers */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <section className={cn(card, 'rounded-xl p-3 sm:rounded-2xl sm:p-5 lg:col-span-2')}>
          <SectionTitle title={tr('dash.recent')} link={{ to: '/admin/orders', label: tr('common.viewAll') }} />
          {!s ? (
            <Skeleton className="mt-3 h-40 rounded-xl" />
          ) : s.recentOrders.length ? (
            <div className="mt-3">
            {/* Phones: one compact row per order */}
            <ul className="-my-1 divide-y divide-[var(--border)] sm:hidden">
              {s.recentOrders.map((o) => {
                const user = o.user as User | undefined
                return (
                  <li key={o._id}>
                    <Link to={`/admin/orders/${o._id}`} className="flex min-w-0 items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium"><bdi dir="ltr">#{o.orderNumber}</bdi></p>
                        <p className="truncate text-[11px] text-[var(--fg-muted)]">
                          {user?.name || o.shippingAddress?.fullName || '—'} · {formatDate(o.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-sm font-medium tabular-nums">{formatCurrency(o.pricing.total)}</span>
                        <Badge variant={orderStatusVariant(o.orderStatus)}>{orderStatusLabel(o.orderStatus)}</Badge>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[34rem] text-sm">
                <thead className="text-left text-xs text-[var(--fg-muted)]">
                  <tr>
                    <th className="pb-2 font-medium">{tr('common.order')}</th>
                    <th className="pb-2 font-medium">{tr('common.customer')}</th>
                    <th className="pb-2 font-medium">{tr('common.date')}</th>
                    <th className="pb-2 text-end font-medium">{tr('common.total')}</th>
                    <th className="pb-2 ps-3 font-medium">{tr('common.payment')}</th>
                    <th className="pb-2 font-medium">{tr('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentOrders.map((o) => {
                    const user = o.user as User | undefined
                    return (
                      <tr key={o._id} className="border-t border-[var(--border)]">
                        <td className="py-2 pe-2">
                          <Link to={`/admin/orders/${o._id}`} className="font-medium text-[var(--brand-text)] hover:underline">
                            <bdi dir="ltr">#{o.orderNumber}</bdi>
                          </Link>
                        </td>
                        <td className="max-w-[9rem] truncate py-2 pe-2">{user?.name || o.shippingAddress?.fullName || '—'}</td>
                        <td className="whitespace-nowrap py-2 pe-2 text-[var(--fg-muted)]">{formatDate(o.createdAt)}</td>
                        <td className="whitespace-nowrap py-2 text-end tabular-nums">{formatCurrency(o.pricing.total)}</td>
                        <td className="py-2 ps-3">
                          <Badge variant={PAYMENT_VARIANT[o.paymentStatus] ?? 'muted'}>{PAYMENT_LABEL[o.paymentStatus] ? tr(PAYMENT_LABEL[o.paymentStatus]) : o.paymentStatus}</Badge>
                        </td>
                        <td className="py-2">
                          <Badge variant={orderStatusVariant(o.orderStatus)}>{orderStatusLabel(o.orderStatus)}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--fg-muted)]">{tr('dash.noOrders')}</p>
          )}
        </section>

        <section className={cn(card, 'rounded-xl p-3 sm:rounded-2xl sm:p-5')}>
          <SectionTitle title={tr('dash.bestSellers', { days: range })} />
          {!a ? (
            <Skeleton className="mt-3 h-40 rounded-xl" />
          ) : a.topProducts.length ? (
            <ol className="mt-3 space-y-1">
              {a.topProducts.map((tp, i) => {
                const row = (
                  <>
                    <span className="w-4 shrink-0 text-xs tabular-nums text-[var(--fg-muted)]">{i + 1}</span>
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                      {tp.image ? <SafeImage src={optimizedImageUrl(tp.image, 96)} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tp.name}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">
                        {tr('dash.soldLine', { units: tp.units, value: formatCurrency(tp.revenue) })}
                      </p>
                    </div>
                  </>
                )
                return (
                  <li key={tp.productId}>
                    {tp.exists ? (
                      <Link
                        to={`/admin/inventory/products/${tp.productId}`}
                        className="flex min-w-0 items-center gap-2.5 rounded-xl p-1.5 hover:bg-[var(--bg-muted)]"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex min-w-0 items-center gap-2.5 p-1.5">{row}</div>
                    )}
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-[var(--fg-muted)]">{tr('dash.noSales')}</p>
          )}
        </section>
      </div>

      {/* Inventory insights */}
      <section className={cn(card, 'rounded-xl p-3 sm:rounded-2xl sm:p-5')}>
        <SectionTitle title={tr('dash.stockWatch')} link={{ to: '/admin/inventory', label: tr('dash.manageInventory') }} />
        {!s ? (
          <Skeleton className="mt-3 h-24 rounded-xl" />
        ) : s.lowStockProducts.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {s.lowStockProducts.map((prod) => (
              <li key={prod._id}>
                <Link
                  to={`/admin/inventory/products/${prod._id}`}
                  className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--brand)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {prod.name}
                      {prod.variantLabel ? <span className="font-normal text-[var(--fg-muted)]"> ({prod.variantLabel})</span> : null}
                    </p>
                    <p className="truncate text-[11px] text-[var(--fg-muted)]">
                      {tr('dash.alertAt', { sku: prod.sku, level: prod.lowStockThreshold ?? 5 })}
                      {!prod.isActive ? tr('dash.inactive') : ''}
                    </p>
                  </div>
                  <Badge variant={prod.stock <= 0 ? 'danger' : 'warning'} className="shrink-0">
                    {prod.stock <= 0 ? tr('dash.out') : tr('dash.left', { count: prod.stock })}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--fg-muted)]">{tr('dash.stockHealthy')}</p>
        )}
      </section>
    </div>
  )
}
