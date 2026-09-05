import { Link, Navigate } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { formatCurrency } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { SalesChart } from '@/components/admin/SalesChart'
import { useAdminStats } from '@/hooks/useAdminStats'
import { ORDER_STATUSES, orderStatusVariant } from '@/lib/admin'
import { hasPermission, staffHomePath } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'

export function Dashboard() {
  const role = useAuthStore((s) => s.user?.role)
  const stats = useAdminStats()

  // Full dashboard is Owner-only; other roles go straight to their workspace
  if (!hasPermission(role, 'dashboard')) {
    return <Navigate to={staffHomePath(role)} replace />
  }

  if (stats.isPending && !stats.data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  const s = stats.data
  if (!s) {
    return <p className="text-sm text-[var(--fg-muted)]">Could not load dashboard.</p>
  }

  const cards: { label: string; value: string; hint: string; icon: SiteIconName; to: string }[] = [
    {
      label: 'Revenue',
      value: formatCurrency(s.revenue),
      hint: `${formatCurrency(s.todayRevenue)} today`,
      icon: 'banknote',
      to: '/admin/orders',
    },
    {
      label: 'Orders',
      value: String(s.orderCount),
      hint: `${s.pendingOrders} pending`,
      icon: 'package',
      to: '/admin/orders',
    },
    {
      label: 'Customers',
      value: String(s.customerCount),
      hint: 'Store accounts',
      icon: 'users',
      to: '/admin/customers',
    },
    {
      label: 'Low stock',
      value: String(s.lowStock),
      hint: `${s.productCount} products`,
      icon: 'alert',
      to: '/admin/inventory',
    },
  ]

  return (
    <div className="min-w-0 space-y-5 sm:space-y-8">
      <AdminHeader
        title="Dashboard"
        description="Live COD pipeline — auto-refreshes about every 90 seconds."
      />

      <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 transition hover:border-[var(--brand)] sm:rounded-2xl sm:p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] text-[var(--fg-muted)] sm:text-sm">{c.label}</p>
              <SiteIcon name={c.icon} size={16} className="shrink-0 text-[var(--brand)] sm:hidden" />
              <SiteIcon name={c.icon} size={20} className="hidden shrink-0 text-[var(--brand)] sm:block" />
            </div>
            <p className="mt-1.5 truncate font-display text-base font-semibold tabular-nums sm:mt-2 sm:text-2xl">
              {c.value}
            </p>
            <p className="mt-1 truncate text-[10px] text-[var(--fg-muted)] sm:text-xs">{c.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-5">
        <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5 lg:col-span-3">
          <div className="mb-3 flex min-w-0 flex-col gap-1 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-sm font-semibold sm:text-base">Sales (14 days)</h2>
            <p className="truncate text-xs text-[var(--fg-muted)]">
              Avg order {formatCurrency(s.avgOrderValue || 0)}
            </p>
          </div>
          <SalesChart data={s.salesByDay || []} />
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5 lg:col-span-2">
          <h2 className="font-display text-sm font-semibold sm:text-base">Order status</h2>
          <ul className="mt-3 space-y-1.5 sm:mt-4 sm:space-y-2">
            {ORDER_STATUSES.map((status) => (
              <li key={status}>
                <Link
                  to={`/admin/orders?status=${status}`}
                  className="flex min-w-0 items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm hover:bg-[var(--bg-muted)]"
                >
                  <Badge variant={orderStatusVariant(status)}>{status}</Badge>
                  <span className="shrink-0 font-medium tabular-nums">
                    {s.ordersByStatus?.[status] || 0}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold sm:text-base">Recent orders</h2>
            <Link to="/admin/orders" className="shrink-0 text-sm text-[var(--brand-text)]">
              View all
            </Link>
          </div>
          <div className="mt-3 space-y-2 sm:mt-4">
            {s.recentOrders?.map((o) => {
              const user = o.user as User
              return (
                <Link
                  key={o._id}
                  to={`/admin/orders/${o._id}`}
                  className="flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm hover:border-[var(--brand)] sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2 sm:contents">
                    <span className="truncate font-medium">#{o.orderNumber}</span>
                    <span className="shrink-0 font-medium tabular-nums sm:order-last">
                      {formatCurrency(o.pricing.total)}
                    </span>
                  </div>
                  <span className="hidden min-w-0 truncate text-[var(--fg-muted)] sm:block">
                    {user?.name || '—'}
                  </span>
                  <Badge variant={orderStatusVariant(o.orderStatus)}>
                    {o.orderStatus === 'processing' ? 'confirmed' : o.orderStatus}
                  </Badge>
                </Link>
              )
            })}
            {!s.recentOrders?.length ? (
              <p className="text-sm text-[var(--fg-muted)]">No orders yet.</p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold sm:text-base">Low stock</h2>
            <Link to="/admin/inventory" className="shrink-0 text-sm text-[var(--brand-text)]">
              Inventory
            </Link>
          </div>
          <div className="mt-3 space-y-2 sm:mt-4">
            {s.lowStockProducts?.map((p) => (
              <Link
                key={p._id}
                to={`/admin/products/${p._id}/edit`}
                className="flex min-w-0 items-center justify-between gap-3 overflow-hidden rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm hover:border-[var(--brand)]"
              >
                <span className="min-w-0 truncate font-medium">{p.name}</span>
                <Badge variant="warning" className="shrink-0">
                  {p.stock} left
                </Badge>
              </Link>
            ))}
            {!s.lowStockProducts?.length ? (
              <p className="text-sm text-[var(--fg-muted)]">Stock looks healthy.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
