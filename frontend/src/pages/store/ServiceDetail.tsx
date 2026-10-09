import { Link, Navigate, useParams } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SafeImage } from '@/components/ui/SafeImage'
import { PhoneText } from '@/components/ui/PhoneText'
import { LegalSectionContent } from '@/components/legal/LegalSectionContent'
import { CONTACT, CUSTOMER_SERVICES, type CustomerService } from '@/lib/site'
import { LEGAL_CONTENT } from '@/lib/legal'
import { useLocaleStore } from '@/store/localeStore'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { useMessages, useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'

const pillPrimary =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

const sectionHeading = 'font-display text-lg font-semibold tracking-tight text-[var(--fg)] sm:text-xl'

export function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>()
  const service = CUSTOMER_SERVICES.find((s) => s.slug === slug)
  if (!service) return <Navigate to="/services" replace />
  return <ServiceDetailContent key={service.id} service={service} />
}

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

  useSeo({
    title: `${item.title} — Brynoxa`,
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
    <Container className="pb-12 pt-6 sm:pb-16 sm:pt-8">
      <Link
        to="/services"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--fg-muted)] transition hover:text-[var(--brand-text)]"
      >
        <SiteIcon name="arrow-left" size={16} className="rtl:rotate-180" />
        {t('services.backToServices')}
      </Link>

      <div className="mt-4 grid items-center gap-6 lg:mt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-12">
        <div>
          <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs font-semibold text-[var(--brand-text)]">
            {item.highlight}
          </span>
          <h1
            id="page-heading"
            className="mt-3 font-display text-2xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl"
          >
            {item.title}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--fg)]/85 sm:text-base sm:leading-7">
            {item.details}
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">{actions}</div>
        </div>
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.35rem] border border-[var(--border)] shadow-soft max-lg:order-first">
          <SafeImage src={service.photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      </div>

      <div className="mt-10 max-w-3xl space-y-10 sm:mt-14">
        {steps.length ? (
          <section aria-labelledby="service-steps">
            <h2 id="service-steps" className={sectionHeading}>
              {t('services.howItWorks')}
            </h2>
            <ol className="mt-4 space-y-2.5">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-[var(--brand-fg)]">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-relaxed text-[var(--fg)]">{step}</p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {service.id === 'support' ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            <li>
              <button
                type="button"
                onClick={() => openWhatsAppPicker()}
                className="flex w-full items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-start transition hover:border-[var(--brand)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                  <SiteIcon name="chat" size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--fg)]">{t('contact.whatsapp')}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">
                    <PhoneText>{CONTACT.whatsapp.value}</PhoneText>
                  </span>
                </span>
              </button>
            </li>
            <li>
              <a
                href={CONTACT.email.href}
                className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 transition hover:border-[var(--brand)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                  <SiteIcon name="mail" size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--fg)]">{t('ui.email')}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--fg-muted)]">{CONTACT.email.value}</span>
                </span>
              </a>
            </li>
          </ul>
        ) : null}

        {terms ? (
          <section aria-labelledby="service-terms">
            <h2 id="service-terms" className={sectionHeading}>
              {t('services.termsHeading')}
            </h2>
            <LegalSectionContent section={terms} />
            <Link
              to="/terms"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] hover:underline"
            >
              {t('legal.termsTitle')}
              {arrow}
            </Link>
          </section>
        ) : null}

        {faqs.length ? (
          <section aria-labelledby="service-faq">
            <h2 id="service-faq" className={sectionHeading}>
              {t('ui.commonQuestions')}
            </h2>
            <dl className="mt-4 space-y-3">
              {faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3.5 sm:px-5"
                >
                  <dt className="text-sm font-semibold text-[var(--fg)] sm:text-base">{faq.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-[var(--fg-muted)]">{faq.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}
      </div>

      <nav aria-labelledby="other-services" className="mt-12 border-t border-[var(--border)] pt-6 sm:mt-16">
        <h2 id="other-services" className="text-sm font-semibold text-[var(--fg-muted)]">
          {t('services.otherServices')}
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {others.map((s) => (
            <li key={s.id}>
              <Link
                to={`/services/${s.slug}`}
                className="inline-flex h-9 items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
              >
                {copy.services.items[s.id].title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Container>
  )
}
