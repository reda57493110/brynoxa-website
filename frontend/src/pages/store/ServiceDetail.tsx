import { Link, Navigate, useParams } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { PhoneText } from '@/components/ui/PhoneText'
import { LegalSectionContent } from '@/components/legal/LegalSectionContent'
import { HomeSectionHead } from '@/components/home/HomeShelf'
import { HomeHelpBand } from '@/components/home/HomeBlocks'
import { CONTACT, CUSTOMER_SERVICES, SERVICE_ICON, type CustomerService } from '@/lib/site'
import { LEGAL_CONTENT } from '@/lib/legal'
import { useLocaleStore } from '@/store/localeStore'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { useMessages, useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { HelpLink } from '@/components/help/HelpLink'
import type { HelpGuideId } from '@/lib/help/types'
import { brandName } from '@/lib/brand'
import { cn } from '@/lib/cn'

const pillPrimary =
  'btn-shine inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-[13px] font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 sm:h-12 sm:px-7 sm:text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

const panel = 'rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-[2rem] sm:p-6 lg:p-7'

/** The step-by-step guide that goes with each service page (null: the list of guides) */
const SERVICE_HELP_GUIDE: Record<CustomerService['id'], HelpGuideId | null> = {
  warranty: 'return',
  returns: 'return',
  cod: 'pay',
  delivery: 'track',
  support: null,
  repair: 'return',
}
const GUIDE_LABEL = { order: 'help.ctxOrder', pay: 'help.ctxPay', track: 'help.ctxTrack', return: 'help.ctxReturn', account: 'help.ctxAny' } as const

export function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>()
  const service = CUSTOMER_SERVICES.find((s) => s.slug === slug)
  if (!service) return <Navigate to="/services" replace />
  return <ServiceDetailContent key={service.id} service={service} />
}

/**
 * One service (/services/warranty …), in the home / shop / setups look: the path, the Brynoxa
 * band (title, what it is, the action, the photo), then the steps, terms and questions in panels,
 * the other services on the side, and the WhatsApp help band.
 */
function ServiceDetailContent({ service }: { service: CustomerService }) {
  const t = useT()
  const copy = useMessages()
  const locale = useLocaleStore((s) => s.locale)
  const openWhatsAppPicker = useWhatsAppStore((s) => s.open)

  const item = copy.services.items[service.id]
  const steps: readonly string[] =
    service.id in copy.services.steps
      ? copy.services.steps[service.id as keyof typeof copy.services.steps]
      : []
  const faqs: readonly { q: string; a: string }[] =
    service.id in copy.services.faqs
      ? copy.services.faqs[service.id as keyof typeof copy.services.faqs]
      : []
  const terms = service.terms
    ? LEGAL_CONTENT[locale].terms.sections.find((s) => s.id === service.terms)
    : undefined
  const others = CUSTOMER_SERVICES.filter((s) => s.id !== service.id)
  const guide = SERVICE_HELP_GUIDE[service.id]

  useSeo({
    title: `${item.title} — ${brandName()}`,
    description: item.summary,
    image: service.photo,
    path: `/services/${service.slug}`,
  })

  const arrow = <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
  const actions =
    service.id === 'support' ? (
      <Link to="/contact" className={pillPrimary}>
        {t('common.contact')}
        {arrow}
      </Link>
    ) : service.id === 'cod' ? (
      <Link to="/shop" className={pillPrimary}>
        {t('common.shopNow')}
        {arrow}
      </Link>
    ) : service.id === 'delivery' ? (
      <Link to="/track-order" className={pillPrimary}>
        {t('orders.trackOrder')}
        {arrow}
      </Link>
    ) : (
      <Link to="/contact" className={pillPrimary}>
        {t('services.openRequest')}
        {arrow}
      </Link>
    )

  return (
    <div className="pb-6 pt-2 sm:pb-8 sm:pt-4">
      <Container>
        {/* Path: Home › Services › Warranty */}
        <nav aria-label={t('shop.breadcrumb')} className="mb-2.5 sm:mb-3">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)] sm:text-[13px]">
            <li>
              <Link to="/" className="hover:text-[var(--brand-text)]">
                {t('common.home')}
              </Link>
            </li>
            <li className="inline-flex items-center gap-1">
              <SiteIcon name="chevron-right" size={12} className="opacity-60 rtl:rotate-180" />
              <Link to="/services" className="hover:text-[var(--brand-text)]">
                {t('common.services')}
              </Link>
            </li>
            <li className="inline-flex min-w-0 items-center gap-1">
              <SiteIcon name="chevron-right" size={12} className="opacity-60 rtl:rotate-180" />
              <span aria-current="page" className="truncate font-semibold uppercase text-[var(--fg)]">
                {item.title}
              </span>
            </li>
          </ol>
        </nav>

        {/* The band: what it is and what to do, with its photo */}
        <section
          aria-labelledby="page-heading"
          className="ink relative isolate grid items-center gap-3 overflow-hidden rounded-[1.25rem] border border-[rgb(0_194_255/0.3)] bg-[#05080b] p-3.5 text-white sm:gap-6 sm:rounded-[2rem] sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-10 lg:p-10"
        >
          <span className="ink-glow absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgb(0_194_255/0.25),transparent_60%),radial-gradient(50%_80%_at_0%_100%,rgb(0_194_255/0.12),transparent_60%)]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--brand)] sm:text-xs">
              <SiteIcon name={SERVICE_ICON[service.id]} size={14} />
              {item.highlight}
            </p>
            <h1 id="page-heading" className="text-white mt-1 font-display text-xl font-black uppercase leading-tight tracking-tight sm:mt-2 sm:text-4xl lg:text-5xl">
              {item.title}
            </h1>
            <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-white/75 sm:mt-3 sm:text-base sm:leading-7">{item.details}</p>
            <div className="mt-3 flex flex-wrap gap-2.5 sm:mt-6">{actions}</div>
          </div>
          <div className="relative aspect-[2/1] overflow-hidden rounded-xl bg-[var(--bg-muted)] max-lg:order-first sm:aspect-[16/10] sm:rounded-[1.4rem]">
            <SafeImage src={service.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </section>

        <div className="mt-3 grid gap-3 sm:mt-5 sm:gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-3 sm:space-y-5">
            {steps.length ? (
              <section aria-labelledby="service-steps" className={panel}>
                <HomeSectionHead id="service-steps" title={t('services.howItWorks')} />
                <ol className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                  {steps.map((step, index) => (
                    <li key={step} className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3 sm:rounded-2xl sm:p-4">
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--brand)] font-display text-sm font-black text-[var(--brand-fg)] shadow-glow sm:size-9 sm:rounded-xl sm:text-base">
                        {index + 1}
                      </span>
                      <p className="pt-0.5 text-[13px] leading-relaxed text-[var(--fg)] sm:pt-1.5 sm:text-sm">{step}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            {service.id === 'cod' ? (
              <section aria-labelledby="service-deposit" className={panel}>
                <HomeSectionHead id="service-deposit" title={t('deposit.serviceTitle')} />
                <p className="text-[13px] leading-relaxed text-[var(--fg)]/85 sm:text-[15px] sm:leading-7">{t('deposit.serviceBody')}</p>
              </section>
            ) : null}

            {service.id === 'support' ? (
              <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <li>
                  <button
                    type="button"
                    onClick={() => openWhatsAppPicker()}
                    className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-start transition hover:border-[var(--brand)] sm:p-4"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow">
                      <SiteIcon name="chat" size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold uppercase text-[var(--fg)]">{t('contact.whatsapp')}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">
                        <PhoneText>{CONTACT.whatsapp.value}</PhoneText>
                      </span>
                    </span>
                  </button>
                </li>
                <li>
                  <a
                    href={CONTACT.email.href}
                    className="group flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 transition hover:border-[var(--brand)] sm:p-4"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bg-muted)] text-[var(--brand-text)]">
                      <SiteIcon name="mail" size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-extrabold uppercase text-[var(--fg)]">{t('ui.email')}</span>
                      <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">{CONTACT.email.value}</span>
                    </span>
                  </a>
                </li>
              </ul>
            ) : null}

            {faqs.length ? (
              <section aria-labelledby="service-faq" className={panel}>
                <HomeSectionHead id="service-faq" title={t('ui.commonQuestions')} />
                <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] sm:rounded-2xl">
                  {faqs.map((faq, i) => (
                    <details key={faq.q} open={i === 0} className="group bg-[var(--bg)] [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-[13px] font-bold text-[var(--fg)] transition hover:text-[var(--brand-text)] sm:px-5 sm:py-4 sm:text-base">
                        {faq.q}
                        <SiteIcon name="chevron-down" size={16} className="shrink-0 text-[var(--fg-muted)] transition group-open:rotate-180" />
                      </summary>
                      <p className="px-3.5 pb-3.5 text-[13px] leading-relaxed text-[var(--fg-muted)] sm:px-5 sm:pb-4 sm:text-sm">{faq.a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            {terms ? (
              <section aria-labelledby="service-terms" className={panel}>
                <HomeSectionHead id="service-terms" title={t('services.termsHeading')} viewAll={{ to: '/terms', label: t('legal.termsTitle') }} />
                <LegalSectionContent section={terms} />
              </section>
            ) : null}
          </div>

          {/* The other services, beside on computers (under on phones) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <nav aria-labelledby="other-services" className={panel}>
              <h2 id="other-services" className="mb-2 font-display text-[13px] font-extrabold uppercase tracking-tight text-[var(--fg)] sm:mb-3 sm:text-base">
                {t('services.otherServices')}
              </h2>
              <ul className="grid grid-cols-2 gap-1.5 lg:grid-cols-1 lg:gap-2">
                {others.map((s) => (
                  <li key={s.id}>
                    <Link
                      to={`/services/${s.slug}`}
                      className={cn(
                        'group flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2 transition hover:border-[var(--brand)] sm:p-2.5',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'
                      )}
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--bg-muted)] text-[var(--brand-text)] transition group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)] sm:size-9">
                        <SiteIcon name={SERVICE_ICON[s.id]} size={17} />
                      </span>
                      <span className="min-w-0 truncate text-[12px] font-bold uppercase text-[var(--fg)] sm:text-[13px]">{copy.services.items[s.id].title}</span>
                      <SiteIcon name="chevron-right" size={14} className="ms-auto hidden shrink-0 text-[var(--fg-muted)] group-hover:text-[var(--brand-text)] lg:block rtl:rotate-180" />
                    </Link>
                  </li>
                ))}
              </ul>
              <HelpLink guide={guide} label={t(guide ? GUIDE_LABEL[guide] : 'help.ctxAny')} className="mt-3 sm:mt-4" />
            </nav>
          </aside>
        </div>
      </Container>
      <HomeHelpBand />
    </div>
  )
}
