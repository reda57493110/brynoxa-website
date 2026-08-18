import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ordersApi } from '@/api/ordersApi'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'

function statusVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'cancelled') return 'danger' as const
  if (status === 'shipped' || status === 'processing') return 'brand' as const
  return 'warning' as const
}

export function OrderDetail() {
  const { orderNumber = '' } = useParams()
  const navigate = useNavigate()
  usePageTitle(orderNumber ? `Order ${orderNumber} — Brynoxa` : 'Order — Brynoxa')
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
      <Container className="py-16">
        <EmptyState
          title="Order not found"
          description="Check the number or go back to your order list."
          actionLabel="Back to orders"
          onAction={() => navigate('/account/orders')}
        />
      </Container>
    )
  }

  const o = order.data

  return (
    <>
      <PageHero
        kicker="Cash on delivery"
        title={`#${o.orderNumber}`}
        description={`Placed ${formatDateTime(o.createdAt)}. Pay the courier when the box arrives.`}
        compact
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(o.orderStatus)}>{o.orderStatus}</Badge>
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] hover:underline"
          >
            <SiteIcon name="arrow-left" size={16} />
            All orders
          </Link>
        </div>
      </PageHero>
      <Container className="py-8 sm:py-10">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {o.items.map((item, i) => (
              <div key={`${item.sku}-${i}`} className={`${surfaceCard} flex gap-4 p-4`}>
                {item.image ? (
                  <img src={item.image} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                ) : null}
                <div className="flex-1">
                  <p className="font-display font-semibold">{item.name}</p>
                  <p className="text-sm text-[var(--fg-muted)]">
                    Qty {item.qty} · {formatCurrency(item.price)}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(item.price * item.qty)}</p>
              </div>
            ))}

            <div className={`${surfaceCard} p-6`}>
              <h2 className="font-display text-lg font-semibold">Tracking</h2>
              <ol className="mt-4 space-y-4">
                {o.timeline.map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)]" />
                    <div>
                      <p className="font-medium capitalize">{t.status}</p>
                      {t.note ? <p className="text-sm text-[var(--fg-muted)]">{t.note}</p> : null}
                      <p className="text-xs text-[var(--fg-muted)]">{formatDateTime(t.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`${surfaceCard} p-6`}>
              <h2 className="font-display font-semibold">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">Subtotal</dt>
                  <dd>{formatCurrency(o.pricing.subtotal)}</dd>
                </div>
                {o.pricing.discount > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-muted)]">Discount</dt>
                    <dd>-{formatCurrency(o.pricing.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">Shipping</dt>
                  <dd>
                    {o.pricing.shipping === 0 ? 'Free' : formatCurrency(o.pricing.shipping)}
                  </dd>
                </div>
                {o.pricing.tax > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-muted)]">Tax</dt>
                    <dd>{formatCurrency(o.pricing.tax)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
                  <dt>Total (COD)</dt>
                  <dd>{formatCurrency(o.pricing.total)}</dd>
                </div>
              </dl>
            </div>

            <div className={`${surfaceCard} p-6 text-sm`}>
              <h2 className="font-display font-semibold">Shipping</h2>
              <p className="mt-2 font-medium">{o.shippingAddress.fullName}</p>
              <p className="mt-1 text-[var(--fg-muted)]">
                {o.shippingAddress.line1}
                <br />
                {o.shippingAddress.city}, Morocco
                <br />
                {o.shippingAddress.phone}
              </p>
            </div>
          </div>
        </div>
      </Container>
    </>
  )
}
