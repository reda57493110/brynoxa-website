import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ordersApi } from '@/api/ordersApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DepositNotice } from '@/components/order/DepositNotice'
import { dueOnDelivery } from '@/lib/deposit'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { useSeo } from '@/hooks/useSeo'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'
import { formatDeliveryDay, orderStatusVariant } from '@/lib/orderStatus'
import { cn } from '@/lib/cn'
import type { Order, PhoneOrderMatch } from '@/types'
import { HelpLink } from '@/components/help/HelpLink'


export function TrackOrder() {
  const t = useT()
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  // Lost order number: the orders made with this phone, in a short form
  const [matches, setMatches] = useState<PhoneOrderMatch[] | null>(null)

  useSeo({
    title: t('orders.trackTitle'),
    description: t('orders.trackDescription'),
    path: '/track-order',
  })

  const lookup = useMutation({
    mutationFn: () => ordersApi.track(orderNumber.trim(), phone.trim()),
    onSuccess: (res) => {
      const data = res.data.data
      if ('phoneMatches' in data) {
        setOrder(null)
        setMatches(data.phoneMatches)
      } else {
        setMatches(null)
        setOrder(data)
      }
    },
    onError: () => {
      setOrder(null)
      setMatches(null)
    },
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
            <div>
              <Input
                label={`${t('orders.trackOrderNumber')} ${t('orders.trackOptional')}`}
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="BRX-20260323-K7M2QX"
                autoComplete="off"
              />
              <p className="mt-1.5 text-xs text-[var(--fg-muted)]">{t('orders.trackLostNumber')}</p>
            </div>
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
            <HelpLink guide="track" label={t('help.ctxTrack')} />
          </form>

          <div className={cn(surfaceCard, 'p-5 sm:p-6')}>
            {matches ? (
              <div className="space-y-4">
                <p className="font-display text-lg font-semibold">{t('orders.trackPhoneResults')}</p>
                <ul className="space-y-3">
                  {matches.map((m) => (
                    <li key={m.orderRef + m.createdAt} className="rounded-xl border border-[var(--border)] p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium tabular-nums" dir="ltr">#{m.orderRef}</p>
                          <p className="text-xs text-[var(--fg-muted)]">
                            {formatDateTime(m.createdAt)} · {m.city}
                          </p>
                        </div>
                        <Badge variant={orderStatusVariant(m.orderStatus)}>{t(orderStatusKey(m.orderStatus))}</Badge>
                      </div>
                      {m.orderStatus === 'rescheduled' && m.rescheduledFor ? (
                        <p className="mt-2 text-sm font-medium">
                          {t('orders.rescheduledFor', { date: formatDeliveryDay(m.rescheduledFor) })}
                        </p>
                      ) : null}
                      <ul className="mt-2 space-y-1 text-sm">
                        {m.items.map((item, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span className="min-w-0">
                              {item.name} <span className="text-[var(--fg-muted)]">×{item.qty}</span>
                            </span>
                            <span className="shrink-0">{formatCurrency(item.price * item.qty)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 border-t border-[var(--border)] pt-2 text-sm font-semibold">
                        {t('checkout.totalCod')}: {formatCurrency(m.total)}
                      </p>
                      {m.timeline.length ? (
                        <ol className="mt-2 space-y-1">
                          {m.timeline.map((step, i) => (
                            <li key={i} className="flex gap-2 text-xs text-[var(--fg-muted)]">
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]" />
                              <span>
                                <span className="font-medium text-[var(--fg)]">{t(orderStatusKey(step.status))}</span> · {formatDateTime(step.at)}
                              </span>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{t('orders.trackPhonePrivacy')}</p>
              </div>
            ) : !order ? (
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
                      {formatCurrency(dueOnDelivery(order))} · {t('orders.dueOnDelivery')}
                    </p>
                  </div>
                  <Badge variant={orderStatusVariant(order.orderStatus)}>
                    {t(orderStatusKey(order.orderStatus))}
                  </Badge>
                </div>

                {order.orderStatus === 'rescheduled' && order.rescheduledFor ? (
                  <p className="text-sm font-medium">
                    {t('orders.rescheduledFor', { date: formatDeliveryDay(order.rescheduledFor) })}
                  </p>
                ) : null}

                <DepositNotice order={order} />

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
