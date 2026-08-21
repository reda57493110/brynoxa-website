import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ordersApi } from '@/api/ordersApi'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { pillGhost, pillPrimary, surfaceCard } from '@/components/layout/pageStyles'
import { Spinner } from '@/components/ui/Spinner'
import { formatCurrency } from '@/lib/format'
import { loadGuestReceipt } from '@/lib/guestReceipt'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

export function OrderConfirmation() {
  const t = useT()
  const { orderNumber = '' } = useParams()
  const isAuth = useAuthStore((s) => Boolean(s.accessToken && s.user))
  usePageTitle(
    orderNumber ? t('orders.titleOne', { number: orderNumber }) : t('orders.confirmedTitlePage')
  )

  const guest = orderNumber ? loadGuestReceipt(orderNumber) : null

  const order = useQuery({
    queryKey: ['order', orderNumber, isAuth ? 'auth' : guest?.email || 'guest'],
    queryFn: async () => {
      if (isAuth) {
        return (await ordersApi.getByNumber(orderNumber)).data.data
      }
      if (guest?.email) {
        return (await ordersApi.getGuestReceipt(orderNumber, guest.email)).data.data
      }
      return guest?.order ?? null
    },
    enabled: Boolean(orderNumber),
    initialData: !isAuth && guest?.order ? guest.order : undefined,
  })

  if (order.isLoading && !order.data) {
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
      <Container className="py-5 sm:py-10">
        <div className={cn(surfaceCard, 'mx-auto max-w-lg px-5 py-8 text-center sm:px-6 sm:py-10')}>
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
          <ul className="mt-5 space-y-2 text-start text-sm text-[var(--fg-muted)] sm:mt-6">
            <li className="flex items-center gap-2">
              <SiteIcon name="package-check" size={15} className="text-[var(--brand-text)]" />
              {t('orders.noCardNow')}
            </li>
            <li className="flex items-center gap-2">
              <SiteIcon name="shield" size={15} className="text-[var(--brand-text)]" />
              {t('cart.warrantyFromDelivery')}
            </li>
          </ul>
          {order.data?.orderStatus === 'pending' && isAuth ? (
            <p className="mt-5 text-sm text-[var(--fg-muted)] sm:mt-6">{t('orders.cancelHint')}</p>
          ) : null}
          {!isAuth ? (
            <p className="mt-5 text-sm text-[var(--fg-muted)] sm:mt-6">{t('orders.guestSaveNumber')}</p>
          ) : null}
          <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            {isAuth ? (
              <Link to={`/account/orders/${orderNumber}`} className={cn(pillPrimary, 'w-full sm:w-auto')}>
                {t('orders.trackOrder')}
              </Link>
            ) : (
              <Link to="/register" className={cn(pillPrimary, 'w-full sm:w-auto')}>
                {t('orders.createAccountTrack')}
              </Link>
            )}
            <Link to="/shop" className={cn(pillGhost, 'w-full bg-[var(--bg)] sm:w-auto')}>
              {t('orders.continueShopping')}
            </Link>
          </div>
        </div>
      </Container>
    </>
  )
}
