import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatDate } from '@/lib/format'

function statusVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'cancelled') return 'danger' as const
  if (status === 'shipped' || status === 'processing') return 'brand' as const
  return 'warning' as const
}

export function Orders() {
  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await ordersApi.list({ limit: 50 })).data.data,
  })

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl font-semibold">Orders</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">Track every purchase</p>

      {orders.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : !orders.data?.length ? (
        <div className="mt-8">
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="When you place an order, it will show up here."
            actionLabel="Start shopping"
            onAction={() => {
              window.location.href = '/shop'
            }}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {orders.data.map((order) => (
            <Link
              key={order._id}
              to={`/account/orders/${order.orderNumber}`}
              className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 transition hover:border-[var(--brand)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold">#{order.orderNumber}</p>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">{formatDate(order.createdAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge variant={statusVariant(order.orderStatus)}>{order.orderStatus}</Badge>
                <span className="font-display font-semibold">
                  {formatCurrency(order.pricing.total)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Container>
  )
}
