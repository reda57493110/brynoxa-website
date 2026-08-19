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
import { useT } from '@/hooks/useT'

export function OrderConfirmation() {
  const t = useT()
  const { orderNumber = '' } = useParams()
  usePageTitle(orderNumber ? t('orders.titleOne', { number: orderNumber }) : t('orders.confirmedTitlePage'))
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
        kicker={t('orders.heroKicker')}
        title={t('orders.confirmedTitle')}
        description={t('orders.confirmedBody')}
      />
      <Container className="py-10">
        <div className={`${surfaceCard} mx-auto max-w-lg px-6 py-10 text-center`}>
          <SiteIcon name="check" size={40} className="mx-auto text-[var(--brand)]" />
          {order.data ? (
            <p className="mt-4 text-sm text-[var(--fg-muted)]">
              {t('orders.orderLine', {
                number: `#${order.data.orderNumber}`,
                amount: formatCurrency(order.data.pricing.total),
              })}
            </p>
          ) : (
            <p className="mt-4 text-sm text-[var(--fg-muted)]">{t('orders.inSystem')}</p>
          )}
          <ul className="mt-6 space-y-2 text-left text-sm text-[var(--fg-muted)]">
            <li className="flex items-center gap-2">
              <SiteIcon name="package-check" size={15} className="text-[var(--brand)]" />
              {t('orders.noCardNow')}
            </li>
            <li className="flex items-center gap-2">
              <SiteIcon name="truck" size={15} className="text-[var(--brand)]" />
              {t('orders.packedSoon')}
            </li>
            <li className="flex items-center gap-2">
              <SiteIcon name="shield" size={15} className="text-[var(--brand)]" />
              {t('cart.warrantyFromDelivery')}
            </li>
          </ul>
          {order.data?.orderStatus === 'pending' ? (
            <p className="mt-6 text-sm text-[var(--fg-muted)]">
              {t('orders.cancelHint')}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={`/account/orders/${orderNumber}`} className={pillPrimary}>
              {t('orders.trackOrder')}
            </Link>
            <Link to="/shop" className={`${pillGhost} bg-[var(--bg)]`}>
              {t('orders.continueShopping')}
            </Link>
          </div>
        </div>
      </Container>
    </>
  )
}
