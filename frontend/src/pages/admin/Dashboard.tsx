import { Link } from 'react-router-dom'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { formatCurrency } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { SalesChart } from '@/components/admin/SalesChart'
import { useAdminStats } from '@/hooks/useAdminStats'
import { ORDER_STATUSES, orderStatusVariant } from '@/lib/admin'
import type { User } from '@/types'

export function Dashboard() {
  const stats = useAdminStats()

  if (stats.isLoading) {
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
    <div className="space-y-8">
      <AdminHeader
        title="Dashboard"
        description="Live COD pipeline — refreshes every 20 seconds."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 transition hover:border-[var(--brand)]"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--fg-muted)]">{c.label}</p>
              <SiteIcon name={c.icon} size={20} className="text-[var(--brand)]" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{c.hint}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display font-semibold">Sales (14 days)</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              Avg order {formatCurrency(s.avgOrderValue || 0)}
            </p>
          </div>
          <SalesChart data={s.salesByDay || []} />
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 lg:col-span-2">
          <h2 className="font-display font-semibold">Order status</h2>
          <ul className="mt-4 space-y-2">
            {ORDER_STATUSES.map((status) => (
              <li key={status}>
                <Link
                  to={`/admin/orders?status=${status}`}
                  className="flex items-center justify-between rounded-xl px-2 py-1.5 text-sm hover:bg-[var(--bg-muted)]"
                >
                  <Badge variant={orderStatusVariant(status)}>{status}</Badge>
                  <span className="font-medium">{s.ordersByStatus?.[status] || 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm text-[var(--brand-text)]">
              View all
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {s.recentOrders?.map((o) => {
              const user = o.user as User
              return (
                <Link
                  key={o._id}
                  to={`/admin/orders/${o._id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm hover:border-[var(--brand)]"
                >
                  <span className="font-medium">#{o.orderNumber}</span>
                  <span className="hidden truncate text-[var(--fg-muted)] sm:block">
                    {user?.name || '—'}
                  </span>
                  <Badge variant={orderStatusVariant(o.orderStatus)}>
                    {o.orderStatus === 'processing' ? 'confirmed' : o.orderStatus}
                  </Badge>
                  <span className="font-medium">{formatCurrency(o.pricing.total)}</span>
                </Link>
              )
            })}
            {!s.recentOrders?.length ? (
              <p className="text-sm text-[var(--fg-muted)]">No orders yet.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Low stock</h2>
            <Link to="/admin/inventory" className="text-sm text-[var(--brand-text)]">
              Inventory
            </Link>
          </div>
          <div className="mt-4 space-y-2">
            {s.lowStockProducts?.map((p) => (
              <Link
                key={p._id}
                to={`/admin/products/${p._id}/edit`}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2.5 text-sm hover:border-[var(--brand)]"
              >
                <span className="truncate font-medium">{p.name}</span>
                <Badge variant="warning">{p.stock} left</Badge>
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
