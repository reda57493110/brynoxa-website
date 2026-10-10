import { useState, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { SalesChart, dayLabel, type SalesMetric } from '@/components/admin/SalesChart'
import { useAdminStats } from '@/hooks/useAdminStats'
import { ORDER_STATUSES, orderStatusVariant } from '@/lib/admin'
import { formatCurrency, formatDate } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { hasPermission, staffHomePath } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/cn'
import type { SalesRange, User } from '@/types'

const RANGES: SalesRange[] = [7, 14, 30, 90]
const card = 'min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]'

const PAYMENT_VARIANT: Record<string, BadgeVariant> = {
  paid: 'success',
  pending: 'warning',
  failed: 'danger',
  refunded: 'muted',
}

/** "▲ 12% vs 1,200 DH prev. 14 days" — or a plain note when there is nothing to compare with. */
function Change({ now, before, days, money }: { now: number | null; before: number | null; days: number; money?: boolean }) {
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

function Kpi({
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

function SectionTitle({ title, link }: { title: string; link?: { to: string; label: string } }) {
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
        <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          {!t || !p ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[6.5rem] rounded-2xl" />)
          ) : (
            <>
              <Kpi
                label={`Revenue · ${range} days`}
                value={formatCurrency(t.revenue)}
                hint={<Change now={t.revenue} before={p.revenue} days={range} money />}
                icon="banknote"
                to="/admin/customers"
              />
              <Kpi
                label={`Orders · ${range} days`}
                value={t.orders}
                hint={
                  <span className="text-[var(--fg-muted)]">
                    {t.completedOrders} delivered · {formatCurrency(t.orderValue)} placed
                  </span>
                }
                icon="package"
                to="/admin/orders"
              />
              <Kpi
                label="Average sale"
                value={t.avgOrderValue !== null ? formatCurrency(t.avgOrderValue) : '—'}
                hint={
                  t.avgOrderValue !== null ? (
                    <Change now={t.avgOrderValue} before={p.avgOrderValue} days={range} money />
                  ) : (
                    <span className="text-[var(--fg-muted)]">No delivered orders in this period</span>
                  )
                }
                icon="tag"
              />
              {a?.profitVisible ? (
                <Kpi
                  label={`Gross profit · ${range} days`}
                  value={t.profit !== null ? formatCurrency(t.profit) : '—'}
                  hint={
                    t.profit !== null ? (
                      <Change now={t.profit} before={p.profit} days={range} money />
                    ) : (
                      <span className="text-[var(--warning)]">
                        {t.salesMissingCost} sale{t.salesMissingCost === 1 ? '' : 's'} without a cost price
                      </span>
                    )
                  }
                  icon="layers"
                  to="/admin/customers"
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
      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
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
        <section className={cn(card, 'p-3 sm:p-5 lg:col-span-2')}>
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-display text-sm font-semibold sm:text-base">Sales ({range} days)</h2>
              {t ? (
                <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
                  {metric === 'revenue'
                    ? `${formatCurrency(t.revenue)} from ${t.completedOrders} delivered order${t.completedOrders === 1 ? '' : 's'}`
                    : `${t.orders} order${t.orders === 1 ? '' : 's'} placed (not cancelled)`}
                </p>
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
          <p className="mt-3 text-[11px] text-[var(--fg-muted)]">
            Revenue counts delivered orders (cash on delivery is paid on delivery), minus coupons and refunds, without
            shipping. Each order is shown on the day it was placed.
          </p>
        </section>

        <section className={cn(card, 'p-3 sm:p-5')}>
          <SectionTitle title="Order pipeline" link={{ to: '/admin/orders', label: 'Orders' }} />
          <ul className="mt-3 space-y-1">
            {ORDER_STATUSES.map((status) => (
              <li key={status}>
                <Link
                  to={`/admin/orders?status=${status}`}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-sm hover:bg-[var(--bg-muted)]"
                >
                  <Badge variant={orderStatusVariant(status)}>{status}</Badge>
                  <span className="shrink-0 font-medium tabular-nums">{s ? s.ordersByStatus?.[status] || 0 : '—'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Recent orders + best sellers */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <section className={cn(card, 'p-3 sm:p-5 lg:col-span-2')}>
          <SectionTitle title="Recent orders" link={{ to: '/admin/orders', label: 'View all' }} />
          {!s ? (
            <Skeleton className="mt-3 h-40 rounded-xl" />
          ) : s.recentOrders.length ? (
            <div className="mt-3 overflow-x-auto">
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
                          <Badge variant={orderStatusVariant(o.orderStatus)}>{o.orderStatus}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--fg-muted)]">No orders yet.</p>
          )}
        </section>

        <section className={cn(card, 'p-3 sm:p-5')}>
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
      <section className={cn(card, 'p-3 sm:p-5')}>
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
