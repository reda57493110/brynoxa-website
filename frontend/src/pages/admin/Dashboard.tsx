import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { DollarSign, Package, Users, AlertTriangle } from 'lucide-react'
import { adminApi } from '@/api/adminApi'
import { formatCurrency, formatDate } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'

export function Dashboard() {
  const stats = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => (await adminApi.dashboard()).data.data,
  })

  if (stats.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  const s = stats.data!

  const cards = [
    { label: 'Revenue', value: formatCurrency(s.revenue), icon: DollarSign },
    { label: 'Orders', value: String(s.orderCount), icon: Package },
    { label: 'Customers', value: String(s.customerCount), icon: Users },
    { label: 'Low stock', value: String(s.lowStock), icon: AlertTriangle },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--fg-muted)]">Brynoxa store overview</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--fg-muted)]">{c.label}</p>
              <c.icon className="h-4 w-4 text-[var(--brand)]" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
          <h2 className="font-display font-semibold">Sales (30 days)</h2>
          <div className="mt-4 space-y-2">
            {(s.salesByDay || []).slice(-10).map((d) => (
              <div key={d._id} className="flex items-center justify-between text-sm">
                <span className="text-[var(--fg-muted)]">{d._id}</span>
                <span>
                  {formatCurrency(d.revenue)} · {d.orders} orders
                </span>
              </div>
            ))}
            {!s.salesByDay?.length && (
              <p className="text-sm text-[var(--fg-muted)]">No sales data yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold">Recent orders</h2>
            <Badge variant="warning">{s.pendingOrders} pending</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {s.recentOrders?.map((o) => (
              <Link
                key={o._id}
                to={`/admin/orders/${o._id}`}
                className="flex items-center justify-between rounded-xl border border-[var(--border)] px-3 py-2 text-sm hover:border-[var(--brand)]"
              >
                <span>#{o.orderNumber}</span>
                <span className="text-[var(--fg-muted)]">{formatDate(o.createdAt)}</span>
                <span className="font-medium">{formatCurrency(o.pricing.total)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
