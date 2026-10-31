import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ordersApi } from '@/api/ordersApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { DepositNotice } from '@/components/order/DepositNotice'
import { OrderProgress } from '@/components/order/OrderProgress'
import { useStatusLine } from '@/lib/orderProgress'
import { dueOnDelivery } from '@/lib/deposit'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency, formatDate } from '@/lib/format'
import { whatsappHref } from '@/lib/whatsapp'
import { useSeo } from '@/hooks/useSeo'
import { useT } from '@/hooks/useT'
import { orderStatusKey } from '@/i18n'
import { formatDeliveryDay, orderStatusVariant } from '@/lib/orderStatus'
import { cn } from '@/lib/cn'
import type { Order, PhoneOrderMatch } from '@/types'
import { HelpLink } from '@/components/help/HelpLink'

const subtle = 'text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]'

/** What the current status means for the customer ("on the way, the courier will call…"). */
function StatusLine({ status, rescheduledFor }: { status: string; rescheduledFor?: string }) {
  const t = useT()
  const line = useStatusLine()(status)
  if (!line && !rescheduledFor) return null
  return (
    <p className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--brand)_8%,transparent)] px-3 py-2.5 text-sm leading-relaxed">
      <SiteIcon name={status === 'delivered' ? 'package-check' : 'truck'} size={16} className="mt-0.5 shrink-0 text-[var(--brand-text)]" />
      <span>
        {line}
        {status === 'rescheduled' && rescheduledFor ? (
          <span className="block font-medium">{t('orders.rescheduledFor', { date: formatDeliveryDay(rescheduledFor) })}</span>
        ) : null}
      </span>
    </p>
  )
}

function ItemsList({ items }: { items: { name: string; qty: number; price: number }[] }) {
  return (
    <ul className="space-y-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex justify-between gap-3">
          <span className="min-w-0">
            {item.name} <span className="text-[var(--fg-muted)]">×{item.qty}</span>
          </span>
          <span className="shrink-0 tabular-nums">{formatCurrency(item.price * item.qty)}</span>
        </li>
      ))}
    </ul>
  )
}

function AskOnWhatsApp({ number }: { number?: string }) {
  const t = useT()
  return (
    <a
      href={whatsappHref(number ? t('orders.trackWhatsAppMessage', { number }) : undefined)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] hover:underline"
    >
      <SiteIcon name="chat" size={15} />
      {t('orders.trackWhatsApp')}
    </a>
  )
}

/** Found with the order number + phone: everything, as on the confirmation. */
function FullOrder({ order }: { order: Order }) {
  const t = useT()
  return (
    <article className={cn(surfaceCard, 'space-y-5 p-4 sm:p-6')}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold" dir="ltr">#{order.orderNumber}</p>
          <p className="text-xs text-[var(--fg-muted)]">
            {t('orders.trackPlaced', { date: formatDate(order.createdAt) })} · {order.shippingAddress.city}
          </p>
        </div>
        <Badge variant={orderStatusVariant(order.orderStatus)}>{t(orderStatusKey(order.orderStatus))}</Badge>
      </header>

      <StatusLine status={order.orderStatus} rescheduledFor={order.rescheduledFor} />
      <OrderProgress status={order.orderStatus} timeline={order.timeline || []} />
      <DepositNotice order={order} />

      <section>
        <h2 className={subtle}>{t('orders.summary')}</h2>
        <div className="mt-2">
          <ItemsList items={order.items} />
        </div>
        <div className="mt-3 space-y-1 border-t border-[var(--border)] pt-3 text-sm">
          <p className="flex justify-between gap-3 font-semibold">
            <span>{t('checkout.totalCod')}</span>
            <span className="tabular-nums">{formatCurrency(order.pricing.total)}</span>
          </p>
          {dueOnDelivery(order) !== order.pricing.total ? (
            <p className="flex justify-between gap-3 text-[var(--fg-muted)]">
              <span className="capitalize">{t('orders.dueOnDelivery')}</span>
              <span className="tabular-nums">{formatCurrency(dueOnDelivery(order))}</span>
            </p>
          ) : null}
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm text-[var(--fg-muted)]">
        <span className="flex items-center gap-1.5">
          <SiteIcon name="user" size={14} />
          {order.shippingAddress.fullName} · {order.shippingAddress.city}
        </span>
        <AskOnWhatsApp number={order.orderNumber} />
      </footer>
    </article>
  )
}

/** Found with the phone only: a short card per order (no name, address or payment details). */
function PhoneMatches({ matches }: { matches: PhoneOrderMatch[] }) {
  const t = useT()
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">{t('orders.trackPhoneResults')}</h2>
        <span className="text-xs text-[var(--fg-muted)]">{t('orders.trackFound', { count: matches.length })}</span>
      </div>
      {matches.map((m) => (
        <article key={m.orderRef + m.createdAt} className={cn(surfaceCard, 'space-y-4 p-4 sm:p-5')}>
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium tabular-nums" dir="ltr">#{m.orderRef}</p>
              <p className="text-xs text-[var(--fg-muted)]">
                {t('orders.trackPlaced', { date: formatDate(m.createdAt) })} · {m.city}
              </p>
            </div>
            <Badge variant={orderStatusVariant(m.orderStatus)}>{t(orderStatusKey(m.orderStatus))}</Badge>
          </header>
          <StatusLine status={m.orderStatus} rescheduledFor={m.rescheduledFor} />
          <OrderProgress status={m.orderStatus} timeline={m.timeline} notes={false} />
          <div className="border-t border-[var(--border)] pt-3">
            <ItemsList items={m.items} />
            <p className="mt-2 flex justify-between gap-3 text-sm font-semibold">
              <span>{t('checkout.totalCod')}</span>
              <span className="tabular-nums">{formatCurrency(m.total)}</span>
            </p>
          </div>
        </article>
      ))}
      <div className="flex flex-col gap-2 rounded-xl bg-[var(--bg-muted)] px-3 py-3 text-xs leading-relaxed text-[var(--fg-muted)]">
        <p className="flex items-start gap-2">
          <SiteIcon name="shield" size={14} className="mt-0.5 shrink-0 text-[var(--brand-text)]" />
          {t('orders.trackPhonePrivacy')}
        </p>
        <span className="ps-6">
          <AskOnWhatsApp />
        </span>
      </div>
    </section>
  )
}

export function TrackOrder() {
  const t = useT()
  const [orderNumber, setOrderNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  // Lost order number: the orders made with this phone, in a short form
  const [matches, setMatches] = useState<PhoneOrderMatch[] | null>(null)
  const results = useRef<HTMLDivElement>(null)

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
      // Phones: the result is below the form
      requestAnimationFrame(() => results.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
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
      <PageHero kicker={t('orders.heroKicker')} title={t('orders.trackHeading')} description={t('orders.trackBody')} />
      <Container className="py-5 sm:py-10">
        <div className="mx-auto max-w-2xl space-y-5">
          <form className={cn(surfaceCard, 'space-y-4 p-4 sm:p-6')} onSubmit={onSubmit}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={t('orders.trackPhone')}
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="06 XX XX XX XX"
                required
                autoComplete="tel"
              />
              <Input
                label={`${t('orders.trackOrderNumber')} ${t('orders.trackOptional')}`}
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="BRX-20260323-K7M2QX"
                dir="ltr"
                autoComplete="off"
              />
            </div>
            <p className="flex items-start gap-1.5 text-xs text-[var(--fg-muted)]">
              <SiteIcon name="help" size={13} className="mt-0.5 shrink-0" />
              {t('orders.trackLostNumber')}
            </p>
            {lookup.isError ? (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-[var(--danger)]/40 px-3 py-2 text-sm text-[var(--danger)]">
                <SiteIcon name="alert" size={15} className="mt-0.5 shrink-0" />
                {getErrorMessage(lookup.error, t('orders.trackNotFound'))}
              </p>
            ) : null}
            <Button type="submit" loading={lookup.isPending} className="h-11 w-full rounded-full">
              <SiteIcon name="search" size={16} />
              {t('orders.trackSubmit')}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--fg-muted)]">
              <HelpLink guide="track" label={t('help.ctxTrack')} />
              <span>
                {t('checkout.haveAccount')}{' '}
                <Link to="/login" state={{ from: '/account/orders' }} className="font-medium text-[var(--brand-text)] hover:underline">
                  {t('checkout.signIn')}
                </Link>
              </span>
            </div>
          </form>

          <div ref={results} aria-live="polite" className="scroll-mt-[calc(var(--nav-height)+1rem)]">
            {order ? <FullOrder order={order} /> : matches ? <PhoneMatches matches={matches} /> : null}
          </div>
        </div>
      </Container>
    </>
  )
}
