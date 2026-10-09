import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { StoreHero, heroChip, heroGhostPill, heroPrimaryPill } from '@/components/layout/StoreHero'
import { CUSTOMER_SERVICES } from '@/lib/site'
import { useMessages, useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'

const photoOverlay =
  'absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent'

const SERVICES_HERO_IMAGE =
  'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=2560&q=80'

export function Services() {
  const reduceMotion = useReducedMotion()
  const copy = useMessages()
  const t = useT()
  const { hash } = useLocation()
  const navigate = useNavigate()

  // Old links like /services#warranty now open the dedicated service page
  useEffect(() => {
    const legacy = CUSTOMER_SERVICES.find((s) => `#${s.id}` === hash)
    if (legacy) navigate(`/services/${legacy.slug}`, { replace: true })
  }, [hash, navigate])

  const HERO_PROOF = [
    { icon: 'shield' as const, label: t('home.proofWarranty') },
    { icon: 'refresh' as const, label: t('services.proofReturns') },
  ]

  useSeo({
    title: t('meta.servicesTitle'),
    description: t('meta.servicesDescription'),
    path: '/services',
  })

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
        <ul className="mt-4 flex flex-wrap gap-2 max-md:hidden">
          {HERO_PROOF.map(({ icon, label }) => (
            <li key={label} className={heroChip}>
              <SiteIcon name={icon} size={13} className="text-[var(--brand)]" />
              {label}
            </li>
          ))}
        </ul>
      </StoreHero>

      <section aria-labelledby="services-grid-heading" className="pb-10 pt-6 sm:pb-14 sm:pt-8">
        <Container>
          <h2
            id="services-grid-heading"
            className="mb-5 font-display text-xl font-semibold tracking-tight sm:text-3xl"
          >
            {t('services.howHandled')}
          </h2>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {CUSTOMER_SERVICES.map((service, i) => {
              const item = copy.services.items[service.id]
              return (
                <motion.li
                  key={service.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ delay: i * 0.05, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Link
                    to={`/services/${service.slug}`}
                    className="group relative flex h-full min-h-[13rem] flex-col overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:min-h-[14rem] sm:p-6"
                  >
                    <SafeImage
                      src={service.photo}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover mix-blend-multiply transition duration-500 group-hover:scale-[1.04] dark:mix-blend-normal"
                      loading="lazy"
                    />
                    <div className={photoOverlay} aria-hidden="true" />
                    <div className="relative flex justify-end">
                      <span className="rounded-full border border-white/25 bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
                        {item.highlight}
                      </span>
                    </div>
                    <div className="relative mt-auto">
                      <h3 className="font-display text-lg font-semibold tracking-tight text-white sm:text-xl">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-white/80">
                        {item.summary}
                      </p>
                      <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] sm:mt-4">
                        {t('services.learnMore')}
                        <SiteIcon
                          name="arrow-right"
                          size={16}
                          className="transition duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                        />
                      </span>
                    </div>
                  </Link>
                </motion.li>
              )
            })}
          </ul>
        </Container>
      </section>
    </>
  )
}
