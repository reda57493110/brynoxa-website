import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { StoreHero, heroChip, heroGhostPill, heroPrimaryPill } from '@/components/layout/StoreHero'
import { PhoneText } from '@/components/ui/PhoneText'
import { CONTACT, CUSTOMER_SERVICES } from '@/lib/site'
import { useMessages, useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
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

const SERVICES_HERO_IMAGE =
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=2560&q=80'

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

  useSeo({
    title: t('meta.servicesTitle'),
    description: t('meta.servicesDescription'),
    path: '/services',
  })

  const policies = catalog.filter((s) =>
    POLICY_IDS.includes(s.id as (typeof POLICY_IDS)[number])
  )
  const extras = catalog.filter(
    (s) => !POLICY_IDS.includes(s.id as (typeof POLICY_IDS)[number])
  )

  return (
    <>
      <StoreHero
        titleId="services-hero-title"
        image={SERVICES_HERO_IMAGE}
        imagePosition="object-[50%_55%]"
        frameOverlay={
          <>
            <div className="absolute end-2.5 top-2.5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-md sm:end-4 sm:top-4 sm:px-3 sm:py-1.5 sm:text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--brand)] opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--brand)]" />
              </span>
              {copy.services.heroTrustChip}
            </div>
            <div className="absolute bottom-2.5 start-2.5 flex max-w-[15rem] items-center gap-2.5 rounded-xl border border-white/60 bg-white/90 p-2 text-[#0c1218] shadow-soft backdrop-blur-md sm:bottom-4 sm:start-4 sm:max-w-[17rem] sm:gap-3 sm:rounded-2xl sm:p-3 dark:border-white/10 dark:bg-[#0e1419]/85 dark:text-white">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-fg)] sm:h-10 sm:w-10 sm:rounded-xl">
                <SiteIcon name="banknote" size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-tight sm:text-sm">
                  {copy.services.heroTrustTitle}
                </span>
                <span className="mt-0.5 block text-[11px] text-[#3d4d5c] sm:text-xs dark:text-white/65">
                  {copy.services.heroTrustBody}
                </span>
              </span>
            </div>
          </>
        }
        kicker={copy.services.heroKicker}
        titleLead={copy.services.heroTitle}
        titleAccent={copy.services.heroTitleAccent}
        description={copy.services.heroBody}
      >
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Link to="/shop" className={heroPrimaryPill}>
            {t('common.shopNow')}
            <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
          </Link>
          <Link to="/contact" className={heroGhostPill}>
            {t('common.contact')}
          </Link>
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-4 sm:gap-2">
          {HERO_PROOF.map(({ icon, label }) => (
            <li key={label} className={heroChip}>
              <SiteIcon name={icon} size={13} className="text-[var(--brand)]" />
              {label}
            </li>
          ))}
        </ul>
      </StoreHero>

      <section aria-labelledby="services-grid-heading" className="pb-4 pt-6 sm:pb-5 sm:pt-8">
        <Container>
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
            <div className="max-w-xl">
              <p className="kicker">{t('services.policies')}</p>
              <h2
                id="services-grid-heading"
                className="mt-2 font-display text-xl font-semibold tracking-tight sm:text-3xl"
              >
                {t('services.howHandled')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                {t('services.howHandledBody')}
              </p>
            </div>

            <div
              className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 lg:max-w-[36rem] lg:justify-end lg:pb-0 [&::-webkit-scrollbar]:hidden"
              aria-label={t('services.jump')}
            >
              {catalog.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={jumpChip}>
                  {s.title}
                </a>
              ))}
            </div>
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
                  className="group relative flex min-h-[13rem] flex-col overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:min-h-[14rem] sm:p-6"
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

      <section aria-label={t('services.policies')} className="py-4 sm:py-5">
        <Container>
          <div className="grid gap-4 lg:grid-cols-3 lg:gap-5">
            {policies.map((service, i) => {
              const photo = SERVICE_PHOTOS[service.id]
              const steps =
                service.id === 'warranty' || service.id === 'returns' || service.id === 'cod'
                  ? copy.services.steps[service.id]
                  : []
              return (
                <article
                  key={service.id}
                  id={service.id}
                  aria-labelledby={`${service.id}-heading`}
                  className="flex scroll-mt-[calc(var(--nav-height)+1rem)] flex-col overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft"
                >
                  <div className="relative aspect-[16/7] overflow-hidden lg:aspect-[16/8]">
                    <SafeImage
                      src={photo}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      loading="lazy"
                    />
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
                      aria-hidden="true"
                    />
                    <p className="absolute bottom-3 start-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white sm:start-5">
                      {String(i + 1).padStart(2, '0')} · {service.highlight}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-col p-5 sm:p-6">
                    <h2
                      id={`${service.id}-heading`}
                      className="font-display text-xl font-semibold tracking-tight sm:text-2xl"
                    >
                      {service.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--fg)]/80">
                      {service.details}
                    </p>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
                      {t('services.howItWorks')}
                    </p>
                    <ol className="mt-2.5 space-y-2">
                      {steps.map((step, index) => (
                        <li
                          key={step}
                          className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 dark:bg-[var(--bg-muted)]"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-[var(--brand-fg)]">
                            {index + 1}
                          </span>
                          <p className="text-sm leading-relaxed text-[var(--fg)]">{step}</p>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-auto pt-5">
                      <Link
                        to={service.id === 'cod' ? '/shop' : '/contact'}
                        className={cn(pillGhost, 'h-10 w-auto px-4 text-sm sm:h-10 sm:text-sm')}
                      >
                        {service.id === 'cod' ? t('common.shopNow') : t('services.openRequest')}
                        <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
                      </Link>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </Container>
      </section>

      <section aria-labelledby="more-services-heading" className="py-4 sm:py-5">
        <Container>
          <div className="max-w-xl">
            <p className="kicker">{t('services.moreKicker')}</p>
            <h2
              id="more-services-heading"
              className="mt-2 font-display text-xl font-semibold tracking-tight sm:text-3xl"
            >
              {t('services.moreTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
              {t('services.moreBody')}
            </p>
          </div>
          <div className="mt-5 grid gap-3 sm:gap-4 md:grid-cols-3">
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
        className="pb-10 pt-4 sm:pb-12 sm:pt-5"
      >
        <Container>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-10 xl:gap-12">
            <div>
              <p className="kicker">{t('ui.faq')}</p>
              <h2
                id="services-faq-heading"
                className="mt-2 font-display text-xl font-semibold tracking-tight sm:text-3xl"
              >
                {t('ui.commonQuestions')}
              </h2>
              <ul className="mt-4 space-y-2.5 sm:mt-5">
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

            <motion.aside
              aria-labelledby="services-cta-heading"
              className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft sm:p-7 lg:sticky lg:top-[calc(var(--nav-height)+1.5rem)] lg:mt-1"
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative grid gap-5">
                <div>
                  <p className="kicker">{t('services.ctaKicker')}</p>
                  <h2
                    id="services-cta-heading"
                    className="mt-2 font-display text-xl font-semibold tracking-tight sm:text-2xl"
                  >
                    {t('services.ctaTitle')}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">
                    {t('services.ctaBody')}
                  </p>
                  <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
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
                              {icon === 'chat' ? <PhoneText>{hint}</PhoneText> : hint}
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
            </motion.aside>
          </div>
        </Container>
      </section>
    </>
  )
}
