import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ordersApi } from '@/api/ordersApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'

function statusVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'cancelled') return 'danger' as const
  if (status === 'shipped' || status === 'processing') return 'brand' as const
  return 'warning' as const
}

export function OrderDetail() {
  const t = useT()
  const { orderNumber = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)
  usePageTitle(orderNumber ? t('orders.titleOne', { number: orderNumber }) : t('orders.titleGeneric'))
  const order = useQuery({
    queryKey: ['order', orderNumber],
    queryFn: async () => (await ordersApi.getByNumber(orderNumber)).data.data,
    enabled: Boolean(orderNumber),
  })

  const cancel = useMutation({
    mutationFn: () => ordersApi.cancel(orderNumber),
    onSuccess: (res) => {
      queryClient.setQueryData(['order', orderNumber], res.data.data)
      void queryClient.invalidateQueries({ queryKey: ['orders'] })
      setConfirmOpen(false)
      toast.success(t('orders.cancelled'))
    },
    onError: (err) => toast.error(getErrorMessage(err)),
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
      <Container className="py-8 sm:py-10">
        <EmptyState
          title={t('orders.notFound')}
          description={t('orders.notFoundBody')}
          actionLabel={t('orders.backToOrders')}
          onAction={() => navigate('/account/orders')}
        />
      </Container>
    )
  }

  const o = order.data

  return (
    <>
      <PageHero
        kicker={t('orders.heroKicker')}
        title={`#${o.orderNumber}`}
        description={t('orders.placedPay', { date: formatDateTime(o.createdAt) })}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={statusVariant(o.orderStatus)}>{t(orderStatusKey(o.orderStatus))}</Badge>
          <Link
            to="/account/orders"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] hover:underline"
          >
            <SiteIcon name="arrow-left" size={16} />
            {t('orders.allOrders')}
          </Link>
          {o.orderStatus === 'pending' ? (
            <Button variant="danger" size="sm" type="button" onClick={() => setConfirmOpen(true)}>
              {t('orders.cancel')}
            </Button>
          ) : null}
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
                    {t('orders.qty', { qty: item.qty })} · {formatCurrency(item.price)}
                  </p>
                </div>
                <p className="font-semibold">{formatCurrency(item.price * item.qty)}</p>
              </div>
            ))}

            <div className={`${surfaceCard} p-6`}>
              <h2 className="font-display text-lg font-semibold">{t('orders.tracking')}</h2>
              <ol className="mt-4 space-y-4">
                {o.timeline.map((entry, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--brand)]" />
                    <div>
                      <p className="font-medium capitalize">{t(orderStatusKey(entry.status))}</p>
                      {entry.note ? <p className="text-sm text-[var(--fg-muted)]">{entry.note}</p> : null}
                      <p className="text-xs text-[var(--fg-muted)]">{formatDateTime(entry.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <div className={`${surfaceCard} p-6`}>
              <h2 className="font-display font-semibold">{t('orders.summary')}</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">{t('orders.subtotal')}</dt>
                  <dd>{formatCurrency(o.pricing.subtotal)}</dd>
                </div>
                {o.pricing.discount > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-muted)]">{t('orders.discount')}</dt>
                    <dd>-{formatCurrency(o.pricing.discount)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">{t('orders.shipping')}</dt>
                  <dd>
                    {o.pricing.shipping === 0 ? t('checkout.free') : formatCurrency(o.pricing.shipping)}
                  </dd>
                </div>
                {o.pricing.tax > 0 ? (
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-muted)]">{t('orders.tax')}</dt>
                    <dd>{formatCurrency(o.pricing.tax)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between border-t border-[var(--border)] pt-2 font-semibold">
                  <dt>{t('orders.totalCod')}</dt>
                  <dd>{formatCurrency(o.pricing.total)}</dd>
                </div>
              </dl>
            </div>

            <div className={`${surfaceCard} p-6 text-sm`}>
              <h2 className="font-display font-semibold">{t('orders.shippingHeading')}</h2>
              <p className="mt-2 font-medium">{o.shippingAddress.fullName}</p>
              <p className="mt-1 text-[var(--fg-muted)]">
                {o.shippingAddress.line1}
                <br />
                {o.shippingAddress.city}, {t('ui.morocco')}
                <br />
                {o.shippingAddress.phone}
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t('orders.cancelTitle')} size="sm">
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
          {t('orders.cancelBody')}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={() => setConfirmOpen(false)}>
            {t('orders.keepOrder')}
          </Button>
          <Button
            variant="danger"
            type="button"
            loading={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {t('orders.cancel')}
          </Button>
        </div>
      </Modal>
    </>
  )
}
