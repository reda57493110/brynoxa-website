import { useState } from 'react'
import { StaffLink } from '@/components/admin/StaffLink'
import { ORDER_ORIGIN_LABEL, customerLabel, originOf, shownEmail } from '@/lib/orderOrigin'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Badge } from '@/components/ui/Badge'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { OrderDepositPanel } from '@/components/admin/OrderDepositPanel'
import { OrderRefundsPanel } from '@/components/admin/OrderRefundsPanel'
import { OrderReturnPanel } from '@/components/admin/OrderReturnPanel'
import { OrderItemThumb } from '@/components/admin/OrderThumbs'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { OrderContactLog, OrderHistory, OrderInternalNote, OrderStatusActions } from '@/components/admin/OrderWorkflow'
import {
  attentionReasons,
  deliveryIssueLabel,
  formatDeliveryDay,
  orderStatusLabel,
  orderStatusVariant,
  refundState,
  refundedTotal,
} from '@/lib/orderStatus'
import type { User } from '@/types'
import { customerWhatsAppHref, telHref } from '@/lib/customerContact'
import { cn } from '@/lib/cn'

const PAYMENT_LABEL: Record<string, string> = { pending: 'Unpaid', paid: 'Paid', failed: 'Not collected', refunded: 'Refunded' }

export function OrderDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const order = useQuery({
    queryKey: ['admin-order', id],
    queryFn: async () => (await adminApi.orders.get(id)).data.data,
    enabled: Boolean(id),
  })

  const remove = useMutation({
    mutationFn: () => adminApi.orders.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Order deleted')
      navigate('/admin/orders', { replace: true })
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

  if (order.isError) {
    return <QueryErrorState onRetry={() => order.refetch()} />
  }

  if (!order.data) return <p>Order not found</p>

  const o = order.data
  const user = o.user as User
  const attention = attentionReasons(o)
  const refund = refundState(o)
  const refunded = refundedTotal(o)

  const phone = o.shippingAddress?.phone || user?.phone
  const tel = telHref(phone)
  const wa = customerWhatsAppHref(phone, o.shippingAddress?.fullName || user?.name || '', o.orderNumber)
  const contactBtn =
    'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] text-sm font-medium active:bg-[var(--bg-muted)] sm:h-9 sm:flex-none sm:px-3'

  const itemsCard = (
        <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {o.items.map((item, i) => (
              <li key={i} className="flex min-w-0 items-center justify-between gap-3">
                {(() => {
                  const productId = typeof item.product === 'string' ? item.product : item.product?._id
                  const body = (
                    <>
                      <OrderItemThumb item={item} size="lg" />
                      <span className="min-w-0 overflow-hidden">
                        <span className="break-words">
                          {item.name} × {item.qty}
                        </span>
                        <span className="block truncate text-xs text-[var(--fg-muted)]">
                          {item.sku}
                          {item.returnedQty ? ` · ${item.returnedQty} returned` : ''}
                        </span>
                      </span>
                    </>
                  )
                  return productId ? (
                    <StaffLink
                      to={`/admin/inventory/products/${productId}`}
                      className="flex min-w-0 items-center gap-3 hover:text-[var(--brand-text)]"
                      fallbackClassName="flex min-w-0 items-center gap-3"
                    >
                      {body}
                    </StaffLink>
                  ) : (
                    <span className="flex min-w-0 items-center gap-3">{body}</span>
                  )
                })()}
                <span className="shrink-0 text-end tabular-nums">
                  {formatCurrency(item.price * item.qty)}
                  {item.listPrice != null && item.listPrice > item.price ? (
                    <span className="block text-xs text-[var(--fg-muted)] line-through">
                      {formatCurrency(item.listPrice * item.qty)}
                    </span>
                  ) : null}
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
  )

  const shippingCard = (
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
  )

  return (
    <div className="min-w-0 space-y-4 max-md:pb-20 sm:space-y-6">
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <Link to="/admin/orders" className="text-sm text-[var(--brand-text)]">
            Back to orders
          </Link>
          <Link
            to={`/admin-print/slips?ids=${o._id}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-sm hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <SiteIcon name="package" size={14} /> Delivery slip
          </Link>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
          <h1 className="min-w-0 break-all font-display text-base font-semibold sm:text-2xl">
            #{o.orderNumber}
          </h1>
          <span className="font-display text-base font-semibold tabular-nums text-[var(--brand-text)] sm:text-xl">{formatCurrency(o.pricing.total)}</span>
          <Badge variant={orderStatusVariant(o.orderStatus)}>{orderStatusLabel(o.orderStatus)}</Badge>
          <Badge variant={o.paymentStatus === 'paid' ? 'success' : o.paymentStatus === 'failed' ? 'muted' : 'default'} className="normal-case">
            Payment: {PAYMENT_LABEL[o.paymentStatus] ?? o.paymentStatus}
          </Badge>
          {refund === 'due' ? (
            <Badge variant="danger" className="normal-case">Refund pending</Badge>
          ) : refund === 'partial' ? (
            <Badge variant="warning" className="normal-case">Refunded {formatCurrency(refunded)}</Badge>
          ) : refund === 'refunded' ? (
            <Badge variant="muted" className="normal-case">Fully refunded</Badge>
          ) : null}
          {originOf(o) !== 'website' ? (
            <Badge variant="brand" className="normal-case">
              From {ORDER_ORIGIN_LABEL[originOf(o)]}
            </Badge>
          ) : null}
          {o.channel === 'wholesale' ? (
            <Badge variant="brand" className="normal-case">
              Wholesale
              {o.wholesaleTier
                ? ` · ${o.wholesaleTier.name} −${o.wholesaleTier.discountPercent}%`
                : ''}
            </Badge>
          ) : null}
        </div>
        <div className="mt-2 min-w-0 space-y-0.5 overflow-hidden text-sm text-[var(--fg-muted)]">
          {user?._id ? (
            <Link to={`/admin/customers/${user._id}`} className="block truncate font-medium text-[var(--fg)] hover:text-[var(--brand-text)]" title="Customer history">
              {customerLabel(user)}
            </Link>
          ) : (
            <p className="truncate font-medium text-[var(--fg)]">{user?.name || '—'}</p>
          )}
          <p className="break-all">{shownEmail(user?.email)}</p>
          <p>{phone || 'No phone'} · COD</p>
          {shownEmail(user?.email) ? (
            <StaffLink
              to={`/admin/emails?order=${o._id}&to=${encodeURIComponent(user.email)}`}
              className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-[var(--brand-text)] hover:underline"
              fallback={null}
            >
              <SiteIcon name="mail" size={15} />
              Email customer
            </StaffLink>
          ) : null}
          <p className="text-xs">{formatDateTime(o.createdAt)}</p>
        </div>
        {tel || wa ? (
          <div className="mt-3 flex gap-2">
            {tel ? (
              <a href={tel} className={contactBtn}>
                <SiteIcon name="phone" size={15} /> Call
              </a>
            ) : null}
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className={contactBtn}>
                <SiteIcon name="chat" size={15} /> WhatsApp
              </a>
            ) : null}
          </div>
        ) : null}
        {attention.length || o.rescheduledFor || o.deliveryIssue ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {attention.map((a) => (
              <span key={a} className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--warning)_15%,transparent)] px-2.5 py-1 font-medium text-[var(--warning)]">
                <SiteIcon name="alert" size={12} /> {a}
              </span>
            ))}
            {o.orderStatus === 'rescheduled' && o.rescheduledFor ? (
              <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1">Delivery on {formatDeliveryDay(o.rescheduledFor)}</span>
            ) : null}
            {o.deliveryIssue && ['delivery_failed', 'rescheduled', 'return_in_transit'].includes(o.orderStatus) ? (
              <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1">
                Last failed attempt: {deliveryIssueLabel(o.deliveryIssue.reason)}
                {o.deliveryIssue.note ? ` — ${o.deliveryIssue.note}` : ''}
              </span>
            ) : null}
            {o.deliveryAttempts ? (
              <span className="rounded-full bg-[var(--bg-muted)] px-2.5 py-1">
                {o.deliveryAttempts} failed attempt{o.deliveryAttempts === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Phones: what was ordered and where it goes come first */}
      <div className="space-y-4 lg:hidden">
        {itemsCard}
        {shippingCard}
      </div>

      <OrderStatusActions key={`${o._id}-${o.orderStatus}`} order={o} />

      <OrderContactLog order={o} />

      <OrderDepositPanel order={o} />

      <OrderRefundsPanel order={o} />

      <OrderReturnPanel order={o} />

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="hidden min-w-0 lg:block">{itemsCard}</div>
        <div className="min-w-0 space-y-4">
          <div className="hidden lg:block">{shippingCard}</div>
          <OrderHistory order={o} />
          <div className="space-y-3 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
            <OrderInternalNote key={o.adminNote || ''} order={o} />
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete order
            </Button>
          </div>
        </div>
      </div>

      {/* Phones: the main actions stay at hand */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {tel ? (
          <a href={tel} className={contactBtn} aria-label="Call the customer">
            <SiteIcon name="phone" size={15} /> Call
          </a>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={contactBtn} aria-label="WhatsApp the customer">
            <SiteIcon name="chat" size={15} /> WhatsApp
          </a>
        ) : null}
        <button
          type="button"
          onClick={() => document.getElementById('order-status')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className={cn(contactBtn, 'border-transparent bg-[var(--brand)] font-semibold text-[var(--brand-fg)]')}
        >
          <SiteIcon name="check" size={15} /> Next step
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete order?"
        description="This permanently removes the order. Reserved stock is restored when needed."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
