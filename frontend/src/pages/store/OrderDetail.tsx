import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { ordersApi } from '@/api/ordersApi'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency, formatDateTime } from '@/lib/format'

export function OrderDetail() {
  const { orderNumber = '' } = useParams()
  const order = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: async () => (await ordersApi.getByNumber(orderNumber)).data.data,
    enabled: Boolean(orderNumber),
  })

  if (order.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!order.data) {
    return (
      <Container className="py-16 text-center">
        <p>Order not found.</p>
        <Link to="/account/orders" className="mt-4 inline-block text-[var(--brand)]">
          Back to orders
        </Link>
      </Container>
    )
  }

  const o = order.data

  return (
    <Container className="py-10">
      <Link
        to="/account/orders"
        className="mb-6 inline-flex items-center gap-2 text-sm text-[var(--fg-muted)] hover:text-[var(--brand)]"
      >
        <ArrowLeft className="h-4 w-4" /> Orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">#{o.orderNumber}</h1>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            Placed {formatDateTime(o.createdAt)} · Cash on delivery
          </p>
        </div>
        <Badge variant={o.orderStatus === 'delivered' ? 'success' : 'brand'}>{o.orderStatus}</Badge>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {o.items.map((item, i) => (
            <div
              key={`${item.sku}-${i}`}
              className="flex gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
            >
              {item.image && (
                <img src={item.image} alt="" className="h-20 w-20 rounded-xl object-cover" />
              )}
              <div className="flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-[var(--fg-muted)]">
                  Qty {item.qty} · {formatCurrency(item.price)}
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(item.price * item.qty)}</p>
            </div>
          ))}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-display text-lg font-semibold">Tracking timeline</h2>
            <ol className="mt-4 space-y-4">
              {o.timeline.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)]" />
                  <div>
                    <p className="font-medium capitalize">{t.status}</p>
                    {t.note && <p className="text-sm text-[var(--fg-muted)]">{t.note}</p>}
                    <p className="text-xs text-[var(--fg-muted)]">{formatDateTime(t.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
            <h2 className="font-display font-semibold">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--fg-muted)]">Subtotal</dt>
                <dd>{formatCurrency(o.pricing.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--fg-muted)]">Discount</dt>
                <dd>-{formatCurrency(o.pricing.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--fg-muted)]">Shipping</dt>
                <dd>{formatCurrency(o.pricing.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--fg-muted)]">Tax</dt>
                <dd>{formatCurrency(o.pricing.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
                <dt>Total (COD)</dt>
                <dd>{formatCurrency(o.pricing.total)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-sm">
            <h2 className="font-display font-semibold">Shipping</h2>
            <p className="mt-2">{o.shippingAddress.fullName}</p>
            <p className="text-[var(--fg-muted)]">
              {o.shippingAddress.line1}
              {o.shippingAddress.line2 ? `, ${o.shippingAddress.line2}` : ''}
              <br />
              {o.shippingAddress.city}, {o.shippingAddress.postalCode}
              <br />
              {o.shippingAddress.country}
              <br />
              {o.shippingAddress.phone}
            </p>
          </div>
        </div>
      </div>
    </Container>
  )
}
