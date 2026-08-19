import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { ORDER_STATUSES, orderStatusVariant } from '@/lib/admin'
import type { OrderStatus, User } from '@/types'

export function OrderDetail() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const [status, setStatus] = useState<OrderStatus>('pending')
  const [note, setNote] = useState('')

  const order = useQuery({
    queryKey: ['admin-order', id],
    queryFn: async () => (await adminApi.orders.get(id)).data.data,
    enabled: Boolean(id),
  })

  useEffect(() => {
    if (order.data) {
      setStatus(order.data.orderStatus)
      setNote(order.data.adminNote || '')
    }
  }, [order.data])

  const update = useMutation({
    mutationFn: () =>
      adminApi.orders.updateStatus(id, {
        orderStatus: status,
        note: `Updated to ${status}`,
        adminNote: note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', id] })
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Order updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
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
        <Link to="/admin/orders" className="text-sm text-[var(--brand-text)]">
          Back to orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold">#{o.orderNumber}</h1>
          <Badge variant={orderStatusVariant(o.orderStatus)}>{o.orderStatus}</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {user?.name} · {user?.email} · {user?.phone || 'no phone'} · COD
        </p>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 lg:grid-cols-[1fr_12rem] lg:items-end">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus)}
          options={ORDER_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Button onClick={() => update.mutate()} loading={update.isPending}>
          Update status
        </Button>
        <Textarea
          className="lg:col-span-2"
          label="Internal note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {o.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  {item.name} × {item.qty}
                  <span className="block text-xs text-[var(--fg-muted)]">{item.sku}</span>
                </span>
                <span>{formatCurrency(item.price * item.qty)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-[var(--border)] pt-3 text-sm">
            <div className="flex justify-between text-[var(--fg-muted)]">
              <dt>Subtotal</dt>
              <dd>{formatCurrency(o.pricing.subtotal)}</dd>
            </div>
            {o.pricing.discount > 0 ? (
              <div className="flex justify-between text-[var(--fg-muted)]">
                <dt>Discount {o.coupon?.code ? `(${o.coupon.code})` : ''}</dt>
                <dd>-{formatCurrency(o.pricing.discount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between text-[var(--fg-muted)]">
              <dt>Shipping</dt>
              <dd>{formatCurrency(o.pricing.shipping)}</dd>
            </div>
            <div className="flex justify-between font-semibold">
              <dt>Total COD</dt>
              <dd>{formatCurrency(o.pricing.total)}</dd>
            </div>
          </dl>
          {o.customerNote ? (
            <p className="mt-3 text-sm text-[var(--fg-muted)]">Note: {o.customerNote}</p>
          ) : null}
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-sm">
            <h2 className="font-semibold">Shipping</h2>
            <p className="mt-2 font-medium">{o.shippingAddress.fullName}</p>
            <p className="text-[var(--fg-muted)]">
              {o.shippingAddress.line1}
              <br />
              {o.shippingAddress.city}
              <br />
              {o.shippingAddress.phone}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-semibold">Timeline</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {o.timeline.map((t, i) => (
                <li key={i}>
                  <p className="font-medium capitalize">{t.status}</p>
                  {t.note ? <p className="text-[var(--fg-muted)]">{t.note}</p> : null}
                  <p className="text-xs text-[var(--fg-muted)]">{formatDateTime(t.at)}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
