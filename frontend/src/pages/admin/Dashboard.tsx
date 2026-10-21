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
import { cn } from '@/lib/cn'
import type { SalesRange, User } from '@/types'

const RANGES: SalesRange[] = [7, 14, 30, 90]

const PAYMENT_VARIANT: Record<string, BadgeVariant> = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'muted',
}

export function Dashboard() {
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
    placeholderData: (prev) => prev,
  })

  // What the shop really earned (product cost, courier, fees, expenses taken off)
  const canSeeProfit = hasPermission(role, 'reports')
  const net = useQuery({
    queryKey: ['admin-dashboard', 'net-profit', range],
    queryFn: async () => (await adminApi.profit.summary(range)).data.data,
    enabled: canDashboard && canSeeProfit,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  })

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
          title="Dashboard"
          description={a ? `${dayLabel(a.from)} – ${dayLabel(a.to)} · Morocco time · refreshes every 90 s` : 'Sales and store overview'}
        />
        <div
          role="radiogroup"
          aria-label="Period"
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
              {r}d
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
                label={`Revenue · ${range} days`}
                value={formatCurrencyRounded(t.revenue)}
                hint={<Change now={t.revenue} before={p.revenue} days={range} money />}
                icon="banknote"
                to="/admin/customers"
              />
              <Kpi
                label={`Orders · ${range} days`}
                value={t.orders}
                hint={
                  <span className="text-[var(--fg-muted)]">
                    {t.completedOrders} delivered · {formatCurrencyRounded(t.orderValue)} placed
                  </span>
                }
                icon="package"
                to="/admin/orders"
              />
              <Kpi
                label="Average sale"
                value={t.avgOrderValue !== null ? formatCurrencyRounded(t.avgOrderValue) : '—'}
                hint={
                  t.avgOrderValue !== null ? (
                    <Change now={t.avgOrderValue} before={p.avgOrderValue} days={range} money />
                  ) : (
                    <span className="text-[var(--fg-muted)]">No delivered orders in this period</span>
                  )
                }
                icon="tag"
              />
              {canSeeProfit ? (
                <Kpi
                  label={`Net profit · ${range} days`}
                  value={net.data ? formatCurrencyRounded(net.data.current.netProfit) : '—'}
                  hint={
                    !net.data ? (
                      <span className="text-[var(--fg-muted)]">After costs, delivery and expenses</span>
                    ) : net.data.current.salesMissingCost > 0 ? (
                      <span className="text-[var(--warning)]">
                        {net.data.current.salesMissingCost} sale{net.data.current.salesMissingCost === 1 ? '' : 's'} without a cost price
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
                  label="Customers"
                  value={s?.customerCount ?? '—'}
                  hint={<span className="text-[var(--fg-muted)]">Store accounts</span>}
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
              label="Pending orders"
              value={s.pendingOrders}
              hint={<span className="text-[var(--fg-muted)]">{s.todayOrders} placed today</span>}
              icon="clock"
              to="/admin/orders?status=pending"
              tone={s.pendingOrders > 0 ? 'warning' : undefined}
            />
            <Kpi
              label="Active products"
              value={s.activeProducts}
              hint={<span className="text-[var(--fg-muted)]">of {s.productCount} in catalog</span>}
              icon="boxes"
              to="/admin/products"
            />
            <Kpi
              label="Low stock"
              value={s.lowStock}
              hint={<span className="text-[var(--fg-muted)]">At or under alert level</span>}
              icon="alert"
              to="/admin/inventory?status=low"
              tone={s.lowStock > 0 ? 'warning' : undefined}
            />
            <Kpi
              label="Out of stock"
              value={s.outOfStock}
              hint={<span className="text-[var(--fg-muted)]">Nothing left to sell</span>}
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
                Sales · {a ? `${dayLabel(a.from)} – ${dayLabel(a.to)}` : `${range} days`}
              </h2>
              {t && p ? (
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <p className="font-display text-xl font-semibold tabular-nums sm:text-2xl">
                    {metric === 'revenue' ? formatCurrencyRounded(t.revenue) : `${t.orders} order${t.orders === 1 ? '' : 's'}`}
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
            Full analytics →
          </Link>
          <p className="mt-3 text-[11px] text-[var(--fg-muted)]">
            Revenue = delivered orders (paid on delivery) minus coupons and refunds, without shipping, on the day each order
            was placed.
          </p>
        </section>

        <section className={cn(card, 'rounded-xl p-3 sm:rounded-2xl sm:p-5')}>
          <SectionTitle title="Order pipeline" link={{ to: '/admin/orders', label: 'Orders' }} />
          <ul className="mt-3 space-y-1">
            <li>
              <Link
                to="/admin/orders?status=attention"
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm font-medium hover:bg-[var(--bg-muted)]"
              >
                <span className="inline-flex items-center gap-1.5">
                  <SiteIcon name="alert" size={14} className="text-[var(--warning)]" /> Needs attention
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
          <SectionTitle title="Recent orders" link={{ to: '/admin/orders', label: 'View all' }} />
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
                        <p className="truncate text-sm font-medium">#{o.orderNumber}</p>
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
                    <th className="pb-2 font-medium">Order</th>
                    <th className="pb-2 font-medium">Customer</th>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 text-end font-medium">Total</th>
                    <th className="pb-2 ps-3 font-medium">Payment</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recentOrders.map((o) => {
                    const user = o.user as User | undefined
                    return (
                      <tr key={o._id} className="border-t border-[var(--border)]">
                        <td className="py-2 pe-2">
                          <Link to={`/admin/orders/${o._id}`} className="font-medium text-[var(--brand-text)] hover:underline">
                            #{o.orderNumber}
                          </Link>
                        </td>
                        <td className="max-w-[9rem] truncate py-2 pe-2">{user?.name || o.shippingAddress?.fullName || '—'}</td>
                        <td className="whitespace-nowrap py-2 pe-2 text-[var(--fg-muted)]">{formatDate(o.createdAt)}</td>
                        <td className="whitespace-nowrap py-2 text-end tabular-nums">{formatCurrency(o.pricing.total)}</td>
                        <td className="py-2 ps-3">
                          <Badge variant={PAYMENT_VARIANT[o.paymentStatus] ?? 'muted'}>{o.paymentStatus}</Badge>
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
            <p className="mt-3 text-sm text-[var(--fg-muted)]">No orders yet.</p>
          )}
        </section>

        <section className={cn(card, 'rounded-xl p-3 sm:rounded-2xl sm:p-5')}>
          <SectionTitle title={`Best sellers · ${range} days`} />
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
                        {tp.units} sold · {formatCurrency(tp.revenue)}
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
            <p className="mt-3 text-sm text-[var(--fg-muted)]">No delivered sales in this period yet.</p>
          )}
        </section>
      </div>

      {/* Inventory insights */}
      <section className={cn(card, 'rounded-xl p-3 sm:rounded-2xl sm:p-5')}>
        <SectionTitle title="Stock to watch" link={{ to: '/admin/inventory', label: 'Manage inventory' }} />
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
                      {prod.sku} · alert at {prod.lowStockThreshold ?? 5}
                      {!prod.isActive ? ' · inactive' : ''}
                    </p>
                  </div>
                  <Badge variant={prod.stock <= 0 ? 'danger' : 'warning'} className="shrink-0">
                    {prod.stock <= 0 ? 'Out' : `${prod.stock} left`}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-[var(--fg-muted)]">Stock looks healthy — nothing at or under its alert level.</p>
        )}
      </section>
    </div>
  )
}
