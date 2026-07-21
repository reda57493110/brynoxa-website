import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { useToastStore } from '@/store/toastStore'
import type { OrderStatus, User } from '@/types'

const statuses: OrderStatus[] = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
]

export function OrderDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [status, setStatus] = useState<OrderStatus>('pending')

  const order = useQuery({
    queryKey: ['admin-order', id],
    queryFn: async () => (await adminApi.orders.get(id)).data.data,
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (order.data) setStatus(order.data.orderStatus)
  }, [order.data])

  const update = useMutation({
    mutationFn: () =>
      adminApi.orders.updateStatus(id, { orderStatus: status, note: `Updated to ${status}` }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', id] })
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      toast('Order updated', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  if (order.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!order.data) return <p>Order not found</p>

  const o = order.data
  const user = o.user as User

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/orders" className="text-sm text-[var(--brand)]">
          Back to orders
        </Link>
        <h1 className="mt-2 font-display text-2xl font-semibold">#{o.orderNumber}</h1>
        <p className="text-sm text-[var(--fg-muted)]">
          {user?.name} · {user?.email} · COD
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus)}
          options={statuses.map((s) => ({ value: s, label: s }))}
        />
        <Button onClick={() => update.mutate()} loading={update.isPending}>
          Update status
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] p-5">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {o.items.map((item, i) => (
              <li key={i} className="flex justify-between">
                <span>
                  {item.name} × {item.qty}
                </span>
                <span>{formatCurrency(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 font-semibold">Total {formatCurrency(o.pricing.total)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] p-5">
          <h2 className="font-semibold">Timeline</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {o.timeline.map((t, i) => (
              <li key={i}>
                <p className="font-medium capitalize">{t.status}</p>
                <p className="text-[var(--fg-muted)]">{t.note}</p>
                <p className="text-xs text-[var(--fg-muted)]">{formatDateTime(t.at)}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
