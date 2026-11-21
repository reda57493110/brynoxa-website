import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { HomeSectionHead } from '@/components/home/HomeShelf'
import { HomeHelpBand } from '@/components/home/HomeBlocks'
import { CUSTOMER_SERVICES, SERVICE_ICON } from '@/lib/site'
import { useMessages, useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'

const panel = 'rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 sm:rounded-[2rem] sm:p-6 lg:p-7'

/**
 * Services (/services), in the same look as the home page, the shop and the setups: the path, the
 * Brynoxa band with the title and the six services as big buttons, then each service as a photo
 * card in a panel, and the WhatsApp help band. Each opens its own page (ServiceDetail).
 */
export function Services() {
  const copy = useMessages()
  const t = useT()
  const { hash } = useLocation()
  const navigate = useNavigate()

  // Old links like /services#warranty now open the dedicated service page
  useEffect(() => {
    const legacy = CUSTOMER_SERVICES.find((s) => `#${s.id}` === hash)
    if (legacy) navigate(`/services/${legacy.slug}`, { replace: true })
  }, [hash, navigate])

  useSeo({
    title: t('meta.servicesTitle'),
    description: t('meta.servicesDescription'),
    path: '/services',
  })

  return (
    <div className="pb-6 pt-2 sm:pb-8 sm:pt-4">
      <Container>
        {/* Path: Home › Services */}
        <nav aria-label={t('shop.breadcrumb')} className="mb-2.5 sm:mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)] sm:text-[13px]">
            <li>
              <Link to="/" className="hover:text-[var(--brand-text)]">
                {t('common.home')}
              </Link>
            </li>
            <li className="inline-flex items-center gap-1">
              <SiteIcon name="chevron-right" size={12} className="opacity-60 rtl:rotate-180" />
              <span aria-current="page" className="font-semibold uppercase text-[var(--fg)]">
                {t('common.services')}
              </span>
            </li>
          </ol>
        </nav>

        {/* The band: title and the six services */}
        <section
          aria-labelledby="services-hero-title"
          className="ink relative isolate overflow-hidden rounded-[1.25rem] border border-[rgb(0_194_255/0.3)] bg-[#05080b] p-3.5 text-white sm:rounded-[2rem] sm:p-8 lg:p-10"
        >
          <span className="ink-glow absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgb(0_194_255/0.25),transparent_60%),radial-gradient(50%_80%_at_0%_100%,rgb(0_194_255/0.12),transparent_60%)]" aria-hidden="true" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand)] sm:text-xs">{t('services.bandKicker')}</p>
          <h1 id="services-hero-title" className="text-white mt-1 font-display text-lg font-black uppercase leading-tight tracking-tight sm:mt-1.5 sm:text-4xl">
            {copy.services.heroTitle} <span className="text-[var(--brand)]">{copy.services.heroTitleAccent}</span>
          </h1>
          <p className="mt-1 max-w-xl text-[12px] text-white/70 sm:mt-1.5 sm:text-base">{copy.services.heroBody}</p>

          <ul className="mt-3 grid grid-cols-2 gap-1.5 sm:mt-7 sm:gap-3 lg:grid-cols-3">
            {CUSTOMER_SERVICES.map((s) => {
              const item = copy.services.items[s.id]
              return (
                <li key={s.id}>
                  <Link
                    to={`/services/${s.slug}`}
                    className="group flex h-full min-w-0 items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] p-2.5 transition hover:border-[var(--brand)] hover:bg-[rgb(0_194_255/0.12)] sm:gap-3.5 sm:rounded-2xl sm:p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  >
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[rgb(0_194_255/0.16)] text-[var(--brand)] transition group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)] sm:size-12 sm:rounded-xl">
                      <SiteIcon name={SERVICE_ICON[s.id]} size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 block break-words text-[11px] font-extrabold uppercase leading-tight sm:text-base">{item.title}</span>
                      <span className="block truncate text-[10px] text-white/60 sm:text-xs">{item.highlight}</span>
                    </span>
                    <SiteIcon name="chevron-right" size={16} className="ms-auto hidden shrink-0 text-white/50 group-hover:text-[var(--brand)] sm:block rtl:rotate-180" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>

        {/* Each service: a photo card (the photo on top, the text under it — never written over it) */}
        <section aria-labelledby="services-grid-heading" className={`${panel} mt-3 sm:mt-5`}>
          <HomeSectionHead id="services-grid-heading" title={t('services.howHandled')} />
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
            {CUSTOMER_SERVICES.map((s) => {
              const item = copy.services.items[s.id]
              return (
                <li key={s.id}>
                  <Link
                    to={`/services/${s.slug}`}
                    className="group grid h-full grid-cols-[38%_minmax(0,1fr)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] transition hover:border-[var(--brand)] sm:flex sm:flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  >
                    <span className="relative block min-h-[6.5rem] overflow-hidden bg-[var(--bg-muted)] sm:aspect-[16/9] sm:min-h-0">
                      <SafeImage src={s.photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]" />
                      <span className="absolute start-1.5 top-1.5 inline-flex max-w-[calc(100%-0.75rem)] items-center gap-1 truncate rounded-md bg-[var(--brand)] px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-[var(--brand-fg)] sm:start-3 sm:top-3 sm:px-2 sm:py-1 sm:text-[11px]">
                        <SiteIcon name={SERVICE_ICON[s.id]} size={12} className="shrink-0" />
                        <span className="truncate">{item.highlight}</span>
                      </span>
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col p-3 sm:p-5">
                      <span className="font-display text-[13px] font-extrabold uppercase leading-tight tracking-tight text-[var(--fg)] sm:text-lg">{item.title}</span>
                      <span className="mt-1 line-clamp-2 text-[12px] leading-snug text-[var(--fg-muted)] sm:text-sm">{item.summary}</span>
                      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[12px] font-bold text-[var(--brand-text)] sm:pt-3 sm:text-sm">
                        {t('services.learnMore')}
                        <SiteIcon name="chevron-right" size={15} className="transition group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      </Container>
      <HomeHelpBand />
    </div>
  )
}
