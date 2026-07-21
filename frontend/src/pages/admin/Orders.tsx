import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/lib/format'
import type { User } from '@/types'

export function Orders() {
  const orders = useQuery({
    queryKey: ['admin-orders'],
    queryFn: async () => (await adminApi.orders.list({ limit: 50 })).data.data,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Orders</h1>
        <p className="text-sm text-[var(--fg-muted)]">COD order pipeline</p>
      </div>

      {orders.isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)]">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-[var(--bg-muted)] text-[var(--fg-muted)]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.data?.map((o) => {
                const user = o.user as User
                return (
                  <tr key={o._id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-3">
                      <Link to={`/admin/orders/${o._id}`} className="font-medium text-[var(--brand)]">
                        #{o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{user?.name || '—'}</td>
                    <td className="px-4 py-3">{formatDate(o.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge>{o.orderStatus}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(o.pricing.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
