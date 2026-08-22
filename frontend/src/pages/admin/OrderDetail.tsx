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
      const next =
        order.data.orderStatus === 'processing' ? 'confirmed' : order.data.orderStatus
      setStatus(next)
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
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <div className="min-w-0">
        <Link to="/admin/orders" className="text-sm text-[var(--brand-text)]">
          Back to orders
        </Link>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="min-w-0 break-all font-display text-lg font-semibold sm:text-2xl">
            #{o.orderNumber}
          </h1>
          <Badge variant={orderStatusVariant(o.orderStatus)}>
            {o.orderStatus === 'processing' ? 'confirmed' : o.orderStatus}
          </Badge>
        </div>
        <div className="mt-2 min-w-0 space-y-0.5 overflow-hidden text-sm text-[var(--fg-muted)]">
          <p className="truncate font-medium text-[var(--fg)]">{user?.name || '—'}</p>
          <p className="break-all">{user?.email}</p>
          <p>{user?.phone || 'No phone'} · COD</p>
          <p className="text-xs">{formatDateTime(o.createdAt)}</p>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:gap-4 sm:rounded-2xl sm:p-5 lg:grid-cols-[1fr_12rem] lg:items-end">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as OrderStatus)}
          options={ORDER_STATUSES.map((s) => ({ value: s, label: s }))}
        />
        <Button
          className="w-full lg:w-auto"
          onClick={() => update.mutate()}
          loading={update.isPending}
        >
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

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {o.items.map((item, i) => (
              <li key={i} className="flex min-w-0 justify-between gap-3">
                <span className="min-w-0 overflow-hidden">
                  <span className="break-words">
                    {item.name} × {item.qty}
                  </span>
                  <span className="block truncate text-xs text-[var(--fg-muted)]">{item.sku}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  {formatCurrency(item.price * item.qty)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-[var(--border)] pt-3 text-sm">
            <div className="flex justify-between text-[var(--fg-muted)]">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(o.pricing.subtotal)}</dd>
            </div>
            {o.pricing.discount > 0 ? (
              <div className="flex justify-between text-[var(--fg-muted)]">
                <dt>Discount {o.coupon?.code ? `(${o.coupon.code})` : ''}</dt>
                <dd className="tabular-nums">-{formatCurrency(o.pricing.discount)}</dd>
              </div>
            ) : null}
            {o.pricing.shipping > 0 ? (
              <div className="flex justify-between text-[var(--fg-muted)]">
                <dt>Shipping</dt>
                <dd className="tabular-nums">{formatCurrency(o.pricing.shipping)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between font-semibold">
              <dt>Total COD</dt>
              <dd className="tabular-nums">{formatCurrency(o.pricing.total)}</dd>
            </div>
          </dl>
          {o.customerNote ? (
            <p className="mt-3 break-words text-sm text-[var(--fg-muted)]">
              Note: {o.customerNote}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-4">
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-sm sm:rounded-2xl sm:p-5">
            <h2 className="font-semibold">Shipping</h2>
            <p className="mt-2 break-words font-medium">{o.shippingAddress.fullName}</p>
            <p className="break-words text-[var(--fg-muted)]">
              {o.shippingAddress.line1}
              <br />
              {o.shippingAddress.city}
              <br />
              <a
                href={`tel:${o.shippingAddress.phone}`}
                className="text-[var(--brand-text)] underline-offset-2 hover:underline"
              >
                {o.shippingAddress.phone}
              </a>
            </p>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
            <h2 className="font-semibold">Timeline</h2>
            <ul className="mt-3 space-y-3 text-sm">
              {o.timeline.map((t, i) => (
                <li key={i} className="min-w-0">
                  <p className="font-medium capitalize">{t.status}</p>
                  {t.note ? (
                    <p className="break-words text-[var(--fg-muted)]">{t.note}</p>
                  ) : null}
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
