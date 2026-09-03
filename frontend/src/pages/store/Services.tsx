import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { CONTACT, CUSTOMER_SERVICES } from '@/lib/site'
import { useMessages, useT } from '@/hooks/useT'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { cn } from '@/lib/cn'

const SERVICE_PHOTOS: Record<(typeof CUSTOMER_SERVICES)[number]['id'], string> = {
  warranty: '/services/warranty.jpg',
  returns: '/services/returns.jpg',
  cod: '/services/cod.jpg',
  delivery: '/services/delivery.jpg',
  support: '/services/support.jpg',
  repair: '/services/repair.jpg',
}

const photoOverlay =
  'absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent'

const POLICY_IDS = ['warranty', 'returns', 'cod'] as const

const pillPrimary =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-12 sm:w-auto sm:text-base'

const pillGhost =
  'inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-5 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-12 sm:w-auto sm:text-base'

function fadeIn(reduce: boolean | null, delay = 0) {
  if (reduce) return { initial: false as const, animate: { opacity: 1 } }
  return {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] as const },
  }
}

const jumpChip =
  'inline-flex h-8 shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-9 sm:px-3.5 sm:text-sm'

export function Services() {
  const reduceMotion = useReducedMotion()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const copy = useMessages()
  const t = useT()
  const openWhatsAppPicker = useWhatsAppStore((s) => s.open)
  const catalog = CUSTOMER_SERVICES.map((s) => ({
    ...s,
    ...copy.services.items[s.id],
  }))

  const HERO_PROOF = [
    { icon: 'shield' as const, label: t('home.proofWarranty') },
    { icon: 'refresh' as const, label: t('services.proofReturns') },
  ]

  const CTA_LINKS = [
    { icon: 'chat' as const, label: t('contact.whatsapp'), hint: CONTACT.whatsapp.value, onClick: () => openWhatsAppPicker() },
    { icon: 'mail' as const, label: t('ui.email'), hint: CONTACT.email.value, href: CONTACT.email.href },
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
        <Container className="relative py-5 sm:py-10">
          <motion.div {...fadeIn(reduceMotion)}>
            <p className="kicker">{copy.services.heroKicker}</p>
            <h1
              id="services-hero-title"
              className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-5xl"
            >
              {copy.services.heroTitle}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)] sm:mt-4 sm:text-lg">
              {copy.services.heroBody}
            </p>
            <div className="mt-5 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              <Link to="/shop" className={pillPrimary}>
                {t('common.shopNow')}
                <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
              </Link>
              <Link to="/contact" className={pillGhost}>
                {t('common.contact')}
              </Link>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2 sm:mt-8">
              {HERO_PROOF.map(({ icon, label }) => (
                <li
                  key={label}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-[11px] font-medium text-[var(--fg)] sm:h-9 sm:gap-2 sm:px-3 sm:text-sm"
                >
                  <SiteIcon name={icon} size={14} className="text-[var(--brand-text)]" />
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>
        </Container>
      </section>

      <section aria-labelledby="services-grid-heading" className="py-6 sm:py-10">
        <Container>
          <div className="mb-5 max-w-xl sm:mb-8">
            <p className="kicker">{t('services.policies')}</p>
            <h2
              id="services-grid-heading"
              className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
            >
              {t('services.howHandled')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
              {t('services.howHandledBody')}
            </p>
          </div>

          <div
            className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:mb-8 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
            aria-label={t('services.jump')}
          >
            {catalog.map((s) => (
              <a key={s.id} href={`#${s.id}`} className={jumpChip}>
                {s.title}
              </a>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
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
                  className="group relative flex min-h-[13.5rem] flex-col overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:min-h-[15.5rem] sm:p-6"
                >
                  <SafeImage
                    src={photo}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-[1.04] dark:mix-blend-normal"
                    loading="lazy"
                  />
                  <div className={photoOverlay} aria-hidden="true" />
                  <div className="relative flex items-start justify-between gap-3">
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-white/75">
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <span className="rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                      {service.highlight}
                    </span>
                  </div>
                  <div className="relative mt-auto">
                    <h3 className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
                      {service.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/80">
                      {service.summary}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] sm:mt-4">
                      {t('services.readPolicy')}
                      <SiteIcon
                        name="arrow-right"
                        size={16}
                        className="transition duration-300 group-hover:translate-x-0.5 rtl:rotate-180"
                      />
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
        return (
          <section
            key={service.id}
            id={service.id}
            aria-labelledby={`${service.id}-heading`}
          className="scroll-mt-[calc(var(--nav-height)+1rem)] py-6 sm:py-10"
          >
            <Container>
              <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
                <div>
                  <p className="kicker">
                    {String(i + 1).padStart(2, '0')} · {service.highlight}
                  </p>
                  <h2
                    id={`${service.id}-heading`}
                    className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
                  >
                    {service.title}
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--fg)]/80 sm:mt-4 sm:text-base">
                    {service.details}
                  </p>
                  <Link
                    to={service.id === 'cod' ? '/shop' : '/contact'}
                    className={cn('mt-5 sm:mt-8', pillGhost, 'h-10 w-auto px-4 text-sm')}
                  >
                    {service.id === 'cod' ? t('common.shopNow') : t('services.openRequest')}
                    <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
                  </Link>
                </div>
                <div className="relative overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg)] shadow-soft dark:bg-[var(--bg-muted)]">
                  <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[2/1] lg:aspect-auto lg:min-h-[12rem]">
                    <SafeImage
                      src={photo}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-multiply dark:opacity-60 dark:mix-blend-normal"
                      loading="lazy"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="relative border-t border-[var(--border)] bg-[var(--bg-elevated)] px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
                    <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fg)]">
                      {t('services.howItWorks')}
                    </p>
                    <ol className="space-y-2">
                      {steps.map((step, index) => (
                        <li
                          key={step}
                          className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-3 shadow-sm dark:bg-[var(--bg-muted)] sm:gap-4 sm:px-4 sm:py-3.5"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-[var(--brand-fg)] sm:h-8 sm:w-8 sm:text-sm">
                            {index + 1}
                          </span>
                          <p className="pt-0.5 text-sm leading-relaxed text-[var(--fg)]">{step}</p>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            </Container>
          </section>
        )
      })}

      <section aria-labelledby="more-services-heading" className="py-6 sm:py-10">
        <Container>
          <div className="max-w-xl">
            <p className="kicker">{t('services.moreKicker')}</p>
            <h2
              id="more-services-heading"
              className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
            >
              {t('services.moreTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
              {t('services.moreBody')}
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:mt-8 sm:gap-4 md:grid-cols-3">
            {extras.map((service) => {
              const photo = SERVICE_PHOTOS[service.id]
              return (
                <article
                  key={service.id}
                  id={service.id}
                  className="group relative scroll-mt-[calc(var(--nav-height)+1rem)] overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg)] p-5 shadow-soft transition duration-300 hover:border-[var(--brand)] sm:p-6"
                >
                  <SafeImage
                    src={photo}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover opacity-70 mix-blend-multiply transition duration-500 group-hover:scale-[1.03] group-hover:opacity-80 dark:opacity-55 dark:mix-blend-normal"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent"
                    aria-hidden="true"
                  />
                  <div className="relative mt-16 flex flex-wrap items-center gap-2 sm:mt-24">
                    <h3 className="font-display text-lg font-semibold text-white">{service.title}</h3>
                    <span className="rounded-full border border-white/25 bg-black/35 px-2 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur-sm">
                      {service.highlight}
                    </span>
                  </div>
                  <p className="relative mt-2 text-sm leading-relaxed text-white/80">
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
        className="py-6 sm:py-10"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="kicker">{t('ui.faq')}</p>
            <h2
              id="services-faq-heading"
              className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
            >
              {t('ui.commonQuestions')}
            </h2>
            <ul className="mt-5 space-y-2.5 sm:mt-8 sm:space-y-3">
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
                      className="flex min-h-12 w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-[var(--bg-muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand)] sm:px-5 sm:py-4"
                      aria-expanded={open}
                      aria-controls={panelId}
                      onClick={() => setOpenFaq(open ? null : i)}
                    >
                      <span className="text-sm font-medium sm:text-base">{item.q}</span>
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
                        <p className="px-4 pb-4 text-sm leading-relaxed text-[var(--fg-muted)] sm:px-5">
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

      <section aria-labelledby="services-cta-heading" className="pb-10 pt-6 sm:pb-14 sm:pt-10">
        <Container>
          <motion.div
            className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--bg)] px-5 py-8 shadow-soft sm:px-10 sm:py-12 lg:px-14 lg:py-14"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="relative grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-12">
              <div>
                <p className="kicker">{t('services.ctaKicker')}</p>
                <h2
                  id="services-cta-heading"
                  className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
                >
                  {t('services.ctaTitle')}
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                  {t('services.ctaBody')}
                </p>
                <div className="mt-6 flex flex-col gap-2.5 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                  <Link to="/contact" className={pillPrimary}>
                    {t('common.contact')}
                    <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
                  </Link>
                  <Link
                    to="/account/orders"
                    className={cn(pillGhost, 'bg-[var(--bg)] dark:bg-white/5')}
                  >
                    {t('services.findOrder')}
                  </Link>
                </div>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                {CTA_LINKS.map(({ icon, label, hint, href, onClick }) => (
                  <li key={label}>
                    {onClick ? (
                      <button
                        type="button"
                        onClick={onClick}
                        className="flex w-full items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 px-4 py-3 text-start transition hover:border-[var(--brand)] dark:bg-black/20"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                          <SiteIcon name={icon} size={16} />
                        </span>
                        <span className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--fg)]">{label}</p>
                          <p className="mt-0.5 truncate text-xs leading-relaxed text-[var(--fg-muted)]">
                            {hint}
                          </p>
                        </span>
                      </button>
                    ) : (
                      <a
                        href={href}
                        className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 px-4 py-3 transition hover:border-[var(--brand)] dark:bg-black/20"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                          <SiteIcon name={icon} size={16} />
                        </span>
                        <span className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--fg)]">{label}</p>
                          <p className="mt-0.5 truncate text-xs leading-relaxed text-[var(--fg-muted)]">
                            {hint}
                          </p>
                        </span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  )
}
