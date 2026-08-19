import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '@/api/ordersApi'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { formatCurrency, formatDate } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'

function statusVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'cancelled') return 'danger' as const
  if (status === 'shipped' || status === 'processing') return 'brand' as const
  return 'warning' as const
}

export function Orders() {
  const t = useT()
  usePageTitle(t('orders.title'))
  const navigate = useNavigate()
  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: async () => (await ordersApi.list({ limit: 50 })).data.data,
  })

  return (
    <>
      <PageHero
        kicker={t('orders.kicker')}
        title={t('orders.heading')}
        description={t('orders.listBody')}
      >
        <Link
          to="/account"
          className="text-sm font-medium text-[var(--brand-text)] hover:underline"
        >
          {t('orders.backToAccount')}
        </Link>
      </PageHero>
      <Container className="py-8 sm:py-10">
        {orders.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : !orders.data?.length ? (
          <EmptyState
            icon="package"
            title={t('orders.emptyTitle')}
            description={t('orders.emptyBody')}
            actionLabel={t('orders.startShopping')}
            onAction={() => navigate('/shop')}
          />
        ) : (
          <div className="space-y-3">
            {orders.data.map((order) => (
              <Link
                key={order._id}
                to={`/account/orders/${order.orderNumber}`}
                className={`${surfaceCard} flex flex-col gap-3 p-5 transition hover:-translate-y-0.5 hover:border-[var(--brand)] sm:flex-row sm:items-center sm:justify-between`}
              >
                <div>
                  <p className="font-display font-semibold">#{order.orderNumber}</p>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant={statusVariant(order.orderStatus)}>{t(orderStatusKey(order.orderStatus))}</Badge>
                  <span className="font-display font-semibold">
                    {formatCurrency(order.pricing.total)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Container>
    </>
  )
}
