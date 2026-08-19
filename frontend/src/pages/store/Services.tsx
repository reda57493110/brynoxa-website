import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { CONTACT, CUSTOMER_SERVICES } from '@/lib/site'
import { useMessages, useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

const SERVICE_PHOTOS: Record<(typeof CUSTOMER_SERVICES)[number]['id'], string> = {
  warranty: '/services/warranty.jpg',
  returns: '/services/returns.jpg',
  cod: '/services/cod.jpg',
  delivery: '/services/delivery.jpg',
  support: '/services/support.jpg',
  repair: '/services/repair.jpg',
}

function servicePhotoClass(id: (typeof CUSTOMER_SERVICES)[number]['id'], extra?: string) {
  const graphic = id === 'warranty' || id === 'returns'
  return cn(
    'absolute inset-0 h-full w-full',
    graphic ? 'object-contain bg-white' : 'object-cover',
    extra
  )
}

const photoOverlay =
  'absolute inset-0 bg-gradient-to-t from-[var(--bg-elevated)] from-[12%] via-[color-mix(in_srgb,var(--bg-elevated)_58%,transparent)] via-45% to-[color-mix(in_srgb,var(--bg-elevated)_18%,transparent)]'

const POLICY_IDS = ['warranty', 'returns', 'cod'] as const

const pillPrimary =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-base font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

const pillGhost =
  'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-5 text-base font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

function fadeIn(reduce: boolean | null, delay = 0) {
  if (reduce) return { initial: false as const, animate: { opacity: 1 } }
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
  }
}

const jumpChip =
  'inline-flex h-9 shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

export function Services() {
  const reduceMotion = useReducedMotion()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const copy = useMessages()
  const t = useT()
  const catalog = CUSTOMER_SERVICES.map((s) => ({
    ...s,
    ...copy.services.items[s.id],
  }))

  const HERO_PROOF = [
    { icon: 'shield' as const, label: t('home.proofWarranty') },
    { icon: 'refresh' as const, label: t('services.proofReturns') },
    { icon: 'package-check' as const, label: t('services.proofPay') },
  ]

  const CTA_FACTS = [
    { icon: 'chat' as const, label: t('contact.whatsapp'), hint: CONTACT.whatsapp.value, href: CONTACT.whatsapp.href },
    { icon: 'mail' as const, label: t('ui.email'), hint: CONTACT.email.value, href: CONTACT.email.href },
    { icon: 'package-check' as const, label: t('services.haveOrder'), hint: t('services.findInAccount'), href: '/account/orders' },
  ]

  useEffect(() => {
    const prev = document.title
    document.title = t('meta.servicesTitle')
    return () => {
      document.title = prev
    }
  }, [t])

  const policies = catalog.filter((s) =>
    POLICY_IDS.includes(s.id as (typeof POLICY_IDS)[number])
  )
  const extras = catalog.filter(
    (s) => !POLICY_IDS.includes(s.id as (typeof POLICY_IDS)[number])
  )

  return (
    <>
      <section aria-labelledby="services-hero-title" className="page-hero">
        <Container className="relative py-8 sm:py-10">
          <motion.div {...fadeIn(reduceMotion)}>
            <p className="kicker">{copy.services.heroKicker}</p>
            <h1
              id="services-hero-title"
              className="mt-2 max-w-2xl font-display text-4xl font-semibold tracking-tight sm:text-5xl"
            >
              {copy.services.heroTitle}
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">
              {copy.services.heroBody}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/shop" className={pillPrimary}>
                {t('common.shopNow')}
                <SiteIcon name="arrow-right" size={16} />
              </Link>
              <Link to="/contact" className={pillGhost}>
                {t('common.contact')}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2">
              {HERO_PROOF.map(({ icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/80 px-3 py-1.5 text-sm text-[var(--fg)]"
                >
                  <SiteIcon name={icon} size={14} className="text-[var(--brand)]" />
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>
        </Container>
      </section>

      <section aria-labelledby="services-grid-heading" className="py-8 sm:py-10">
        <Container>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="kicker">
                {t('services.policies')}
              </p>
              <h2
                id="services-grid-heading"
                className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                {t('services.howHandled')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                {t('services.howHandledBody')}
              </p>
            </div>
          </div>

          <div
            className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
            aria-label={t('services.jump')}
          >
            {catalog.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={jumpChip}>
                {s.title}
              </a>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.map((service, i) => {
              const photo = SERVICE_PHOTOS[service.id]
              return (
                <motion.a
                  key={service.id}
                  href={`#${service.id}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative flex min-h-[15.5rem] flex-col overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                >
                  <img
                    src={photo}
                    alt=""
                    className={servicePhotoClass(service.id, 'transition duration-500 group-hover:scale-[1.04]')}
                    loading="lazy"
                  />
                  <div className={photoOverlay} aria-hidden="true" />
                  <div className="relative flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--fg-muted)]">
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--bg)]/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)] backdrop-blur-sm">
                      {service.highlight}
                    </span>
                  </div>
                  <div className="relative mt-auto">
                    <h3 className="font-display text-xl font-semibold tracking-tight">{service.title}</h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                      {service.summary}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)]">
                      {t('services.readPolicy')}
                      <SiteIcon name="arrow-right" size={16} className="transition duration-300 group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </motion.a>
              )
            })}
          </div>
        </Container>
      </section>

      {policies.map((service, i) => {
        const photo = SERVICE_PHOTOS[service.id]
        const steps =
          service.id === 'warranty' || service.id === 'returns' || service.id === 'cod'
            ? copy.services.steps[service.id]
            : []
        const elevated = i % 2 === 0
        return (
          <section
            key={service.id}
            id={service.id}
            aria-labelledby={`${service.id}-heading`}
            className={cn(
              'scroll-mt-[calc(var(--nav-height)+1rem)] py-8 sm:py-10',
              elevated && 'bg-[var(--bg-elevated)]'
            )}
          >
            <Container>
              <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
                <div>
                  <p className="kicker">
                    {String(i + 1).padStart(2, '0')} · {service.highlight}
                  </p>
                  <h2
                    id={`${service.id}-heading`}
                    className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
                  >
                    {service.title}
                  </h2>
                  <p className="mt-4 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                    {service.details}
                  </p>
                  <Link
                    to={service.id === 'cod' ? '/shop' : '/contact'}
                    className={cn('mt-8', pillGhost, 'h-10 px-4 text-sm')}
                  >
                    {service.id === 'cod' ? t('common.shopNow') : t('services.openRequest')}
                    <SiteIcon name="arrow-right" size={16} />
                  </Link>
                </div>
                <div className="relative overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg)] p-2 shadow-soft sm:p-3 dark:bg-[var(--bg-muted)]">
                  <img
                    src={photo}
                    alt=""
                    className={servicePhotoClass(service.id, 'pointer-events-none opacity-35')}
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-[var(--bg)]/55 dark:bg-[var(--bg-muted)]/65" aria-hidden="true" />
                  <p className="relative px-3 pb-2 pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                    {t('services.howItWorks')}
                  </p>
                  <ol className="relative space-y-2">
                    {steps.map((step, index) => (
                      <li key={step} className="flex gap-4 rounded-2xl bg-[var(--bg-elevated)] px-4 py-3.5 dark:bg-[var(--bg)]">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-[var(--brand-fg)]">
                          {index + 1}
                        </span>
                        <p className="pt-1 text-sm leading-relaxed text-[var(--fg)]">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </Container>
          </section>
        )
      })}

      <section
        aria-labelledby="more-services-heading"
        className="py-8 sm:py-10"
      >
        <Container>
          <div className="max-w-xl">
            <p className="kicker">
              {t('services.moreKicker')}
            </p>
            <h2
              id="more-services-heading"
              className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {t('services.moreTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
              {t('services.moreBody')}
            </p>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {extras.map((service) => {
              const photo = SERVICE_PHOTOS[service.id]
              return (
                <article
                  key={service.id}
                  id={service.id}
                  className="group relative scroll-mt-[calc(var(--nav-height)+1rem)] overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-soft transition duration-300 hover:border-[var(--brand)]"
                >
                  <img
                    src={photo}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-40 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-50"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-[var(--bg-elevated)] from-40% via-[color-mix(in_srgb,var(--bg-elevated)_78%,transparent)] to-[color-mix(in_srgb,var(--bg-elevated)_40%,transparent)]"
                    aria-hidden="true"
                  />
                  <div className="relative mt-24 flex flex-wrap items-center gap-2 sm:mt-28">
                    <h3 className="font-display text-lg font-semibold">{service.title}</h3>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--bg)]/80 px-2 py-0.5 text-[11px] font-semibold text-[var(--fg-muted)] backdrop-blur-sm">
                      {service.highlight}
                    </span>
                  </div>
                  <p className="relative mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                    {service.details}
                  </p>
                </article>
              )
            })}
          </div>
        </Container>
      </section>

      <section
        aria-labelledby="services-faq-heading"
        className="bg-[var(--bg-elevated)] py-8 sm:py-10"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="kicker">
              {t('ui.faq')}
            </p>
            <h2
              id="services-faq-heading"
              className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              {t('ui.commonQuestions')}
            </h2>
            <ul className="mt-8 space-y-3">
              {copy.services.faqs.map((item, i) => {
                const open = openFaq === i
                const panelId = `services-faq-${i}`
                return (
                  <li
                    key={item.q}
                    className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg)]"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[var(--bg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)]"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenFaq(open ? null : i)}
                    >
                      <span className="font-medium">{item.q}</span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 text-[var(--fg-muted)] transition duration-300',
                          open && 'rotate-180'
                        )}
                      >
                        <SiteIcon name="chevron-down" size={16} />
                      </span>
                    </button>
                    <div
                      id={panelId}
                      className={cn(
                        'grid transition-[grid-template-rows] duration-300',
                        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                      )}
                    >
                      <div className="overflow-hidden">
                        <p className="px-5 pb-4 text-sm leading-relaxed text-[var(--fg-muted)]">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </Container>
      </section>

      <section aria-labelledby="services-cta-heading" className="pb-12 pt-8 sm:pb-14 sm:pt-10">
        <Container>
          <motion.div
            className="cta-band relative overflow-hidden rounded-[1.75rem] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <SiteIcon
              name="shield"
              size={96}
              className="pointer-events-none absolute -left-8 bottom-[-2rem] text-[var(--brand)] opacity-[0.12]"
            />
            <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_18.5rem] lg:gap-16">
              <div>
                <p className="kicker">
                  {t('services.ctaKicker')}
                </p>
                <h2
                  id="services-cta-heading"
                  className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
                >
                  {t('services.ctaTitle')}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                  {t('services.ctaBody')}
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link to="/contact" className={pillPrimary}>
                    {t('common.contact')}
                    <SiteIcon name="arrow-right" size={16} />
                  </Link>
                  <Link to="/account/orders" className={cn(pillGhost, 'bg-[var(--bg)] dark:bg-white/5')}>
                    {t('services.findOrder')}
                  </Link>
                </div>
              </div>
              <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {CTA_FACTS.map(({ icon, label, hint, href }) => {
                  const isInternal = href.startsWith('/')
                  const className =
                    'flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 px-4 py-3.5 transition hover:border-[var(--brand)] dark:bg-black/20'
                  const body = (
                    <>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)] dark:text-[var(--brand)]">
                        <SiteIcon name={icon} size={16} />
                      </span>
                      <span>
                        <p className="text-sm font-semibold text-[var(--fg)]">{label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-muted)]">{hint}</p>
                      </span>
                    </>
                  )
                  return (
                    <li key={label}>
                      {isInternal ? (
                        <Link to={href} className={className}>
                          {body}
                        </Link>
                      ) : (
                        <a href={href} className={className}>
                          {body}
                        </a>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  )
}
