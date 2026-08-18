import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ordersApi } from '@/api/ordersApi'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { pillGhost, pillPrimary, surfaceCard } from '@/components/layout/pageStyles'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'

export function OrderConfirmation() {
  const { orderNumber = '' } = useParams()
  usePageTitle(orderNumber ? `Order ${orderNumber} — Brynoxa` : 'Order confirmed — Brynoxa')
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

  return (
    <>
      <PageHero
        kicker="Cash on delivery"
        title="Order confirmed"
        description="Thank you. We pack after confirmation — pay the courier when the box arrives."
      />
      <Container className="py-10">
        <div className={`${surfaceCard} mx-auto max-w-lg px-6 py-10 text-center`}>
          <SiteIcon name="check" size={40} className="mx-auto text-[var(--brand)]" />
          {order.data ? (
            <p className="mt-4 text-sm text-[var(--fg-muted)]">
              Order <span className="font-semibold text-[var(--fg)]">#{order.data.orderNumber}</span>
              {' · '}
              {formatCurrency(order.data.pricing.total)} due on delivery
            </p>
          ) : (
            <p className="mt-4 text-sm text-[var(--fg-muted)]">Your COD order is in the system.</p>
          )}
          <ul className="mt-6 space-y-2 text-left text-sm text-[var(--fg-muted)]">
            <li className="flex items-center gap-2">
              <SiteIcon name="package-check" size={15} className="text-[var(--brand)]" />
              No card charge now
            </li>
            <li className="flex items-center gap-2">
              <SiteIcon name="truck" size={15} className="text-[var(--brand)]" />
              Packed in 1–2 business days
            </li>
            <li className="flex items-center gap-2">
              <SiteIcon name="shield" size={15} className="text-[var(--brand)]" />
              6-month warranty from delivery
            </li>
          </ul>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={`/account/orders/${orderNumber}`} className={pillPrimary}>
              Track order
            </Link>
            <Link to="/shop" className={`${pillGhost} bg-[var(--bg)]`}>
              Continue shopping
            </Link>
          </div>
        </div>
      </Container>
    </>
  )
}
