import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ordersApi } from '@/api/ordersApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { useSeo } from '@/hooks/useSeo'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'
import { cn } from '@/lib/cn'
import type { Order } from '@/types'

function statusVariant(status: string) {
  if (status === 'delivered') return 'success' as const
  if (status === 'cancelled') return 'danger' as const
  if (status === 'shipped') return 'brand' as const
  if (status === 'confirmed') return 'success' as const
  return 'warning' as const
}

export function TrackOrder() {
  const t = useT()
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState<Order | null>(null)

  useSeo({
    title: t('orders.trackTitle'),
    description: t('orders.trackDescription'),
    path: '/track-order',
  })

  const lookup = useMutation({
    mutationFn: () => ordersApi.track(orderNumber.trim(), phone.trim()),
    onSuccess: (res) => setOrder(res.data.data),
    onError: () => setOrder(null),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    lookup.mutate()
  }

  return (
    <>
      <PageHero
        kicker={t('orders.heroKicker')}
        title={t('orders.trackHeading')}
        description={t('orders.trackBody')}
      />
      <Container className="py-5 sm:py-10">
        <div className="mx-auto grid max-w-3xl gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
          <form className={cn(surfaceCard, 'space-y-4 p-5 sm:p-6')} onSubmit={onSubmit}>
            <Input
              label={t('orders.trackOrderNumber')}
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="BRX-20260323-1234"
              required
              autoComplete="off"
            />
            <Input
              label={t('orders.trackPhone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="07 XX XX XX XX"
              required
              autoComplete="tel"
            />
            {lookup.isError ? (
              <p className="text-sm text-[var(--danger)]">
                {getErrorMessage(lookup.error, t('orders.trackNotFound'))}
              </p>
            ) : null}
            <Button type="submit" loading={lookup.isPending} className="w-full sm:w-auto">
              {t('orders.trackSubmit')}
            </Button>
            <p className="text-xs text-[var(--fg-muted)]">{t('orders.trackHint')}</p>
          </form>

          <div className={cn(surfaceCard, 'p-5 sm:p-6')}>
            {!order ? (
              <div className="flex h-full min-h-[12rem] flex-col items-center justify-center text-center text-sm text-[var(--fg-muted)]">
                <SiteIcon name="package" size={28} className="mb-3 text-[var(--brand)]" />
                <p>{t('orders.trackEmpty')}</p>
                <Link to="/login" className="mt-3 text-[var(--brand-text)] hover:underline">
                  {t('orders.createAccountTrack')}
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-semibold">#{order.orderNumber}</p>
                    <p className="text-sm text-[var(--fg-muted)]">
                      {formatCurrency(order.pricing.total)} · {t('orders.dueOnDelivery')}
                    </p>
                  </div>
                  <Badge variant={statusVariant(order.orderStatus)}>
                    {t(orderStatusKey(order.orderStatus))}
                  </Badge>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                    {t('orders.tracking')}
                  </p>
                  <ol className="mt-3 space-y-3">
                    {(order.timeline || []).map((step, i) => (
                      <li key={`${step.status}-${step.at}-${i}`} className="flex gap-3 text-sm">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand)]" />
                        <div>
                          <p className="font-medium">{t(orderStatusKey(step.status))}</p>
                          {step.note ? (
                            <p className="text-[var(--fg-muted)]">{step.note}</p>
                          ) : null}
                          <p className="text-xs text-[var(--fg-muted)]">{formatDateTime(step.at)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                    {t('orders.summary')}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {order.items.map((item, i) => (
                      <li key={`${item.sku}-${i}`} className="flex justify-between gap-3">
                        <span>
                          {item.name}{' '}
                          <span className="text-[var(--fg-muted)]">×{item.qty}</span>
                        </span>
                        <span className="shrink-0">{formatCurrency(item.price * item.qty)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-sm text-[var(--fg-muted)]">
                  {order.shippingAddress.city} · {order.shippingAddress.fullName}
                </p>
              </div>
            )}
          </div>
        </div>
      </Container>
    </>
  )
}
