import { Link } from 'react-router-dom'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useSeo } from '@/hooks/useSeo'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { LEGAL_CONTENT, type LegalPage } from '@/lib/legal'
import { CONTACT, LEGAL } from '@/lib/site'
import { cn } from '@/lib/cn'

const DATE_LOCALES = { en: 'en-GB', fr: 'fr-MA', ar: 'ar-MA' } as const

/** Keeps emails and phone numbers left-to-right inside Arabic sentences. */
const isolate = (value: string) => `\u2066${value}\u2069`

export function Legal({ page }: { page: LegalPage }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const doc = LEGAL_CONTENT[locale][page]
  const isTerms = page === 'terms'
  const title = t(isTerms ? 'legal.termsTitle' : 'legal.privacyTitle')
  const other = isTerms
    ? { to: '/privacy', label: t('legal.privacyTitle') }
    : { to: '/terms', label: t('legal.termsTitle') }

  useSeo({
    title: t(isTerms ? 'meta.termsTitle' : 'meta.privacyTitle'),
    description: t(isTerms ? 'meta.termsDescription' : 'meta.privacyDescription'),
    path: isTerms ? '/terms' : '/privacy',
  })

  const fill = (text: string) =>
    text
      .replaceAll('{email}', isolate(CONTACT.email.value))
      .replaceAll('{phone}', isolate(CONTACT.phone.value))

  const updated = new Intl.DateTimeFormat(DATE_LOCALES[locale], { dateStyle: 'long' }).format(
    new Date(`${LEGAL.updated}T12:00:00`)
  )

  const business = [
    { label: t('legal.businessName'), value: LEGAL.businessName },
    { label: t('legal.address'), value: LEGAL.address },
    { label: t('legal.ice'), value: LEGAL.ice },
    { label: t('legal.rc'), value: LEGAL.rc },
    { label: t('legal.email'), value: CONTACT.email.value, href: CONTACT.email.href },
    { label: t('legal.phone'), value: CONTACT.phone.value, href: CONTACT.phone.href },
  ].filter((row) => row.value)

  return (
    <>
      <PageHero kicker={t('legal.kicker')} title={title} description={t('legal.updated', { date: updated })} />

      <Container className="pb-12 pt-5 sm:pb-16 sm:pt-8">
        <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <aside className="hidden lg:block">
            <nav
              aria-label={t('legal.onThisPage')}
              className="sticky top-[calc(var(--nav-height)+1.5rem)] space-y-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                {t('legal.onThisPage')}
              </p>
              <ul className="space-y-1.5 border-s border-[var(--border)]">
                {doc.sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="-ms-px block border-s border-transparent ps-3 text-sm text-[var(--fg-muted)] transition hover:border-[var(--brand)] hover:text-[var(--fg)]"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ul>
              <Link
                to={other.to}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)] hover:underline"
              >
                {other.label}
                <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
              </Link>
            </nav>
          </aside>

          <article className="min-w-0 max-w-3xl">
            <p className="text-[15px] leading-relaxed text-[var(--fg)] sm:text-base sm:leading-7">
              {doc.intro}
            </p>

            <section
              aria-labelledby="legal-business"
              className={cn(surfaceCard, 'mt-6 p-4 sm:p-5')}
            >
              <h2 id="legal-business" className="font-display text-base font-semibold text-[var(--fg)]">
                {t('legal.businessTitle')}
              </h2>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {business.map((row) => (
                  <div key={row.label} className="min-w-0">
                    <dt className="text-xs text-[var(--fg-muted)]">{row.label}</dt>
                    <dd className="mt-0.5 truncate text-sm font-medium text-[var(--fg)]">
                      {row.href ? (
                        <a href={row.href} dir="ltr" className="hover:text-[var(--brand-text)]">
                          {row.value}
                        </a>
                      ) : (
                        row.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="mt-8 space-y-8">
              {doc.sections.map((section) => (
                <section
                  key={section.id}
                  id={section.id}
                  className="scroll-mt-[calc(var(--nav-height)+1.5rem)]"
                >
                  <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--fg)] sm:text-xl">
                    {section.title}
                  </h2>
                  {section.paragraphs?.map((p) => (
                    <p
                      key={p}
                      className="mt-3 text-sm leading-relaxed text-[var(--fg)]/85 sm:text-[15px] sm:leading-7"
                    >
                      {fill(p)}
                    </p>
                  ))}
                  {section.list ? (
                    <ul className="mt-3 space-y-2">
                      {section.list.map((item) => (
                        <li
                          key={item}
                          className="flex gap-2.5 text-sm leading-relaxed text-[var(--fg)]/85 sm:text-[15px] sm:leading-7"
                        >
                          <span
                            className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--brand)]"
                            aria-hidden="true"
                          />
                          <span>{fill(item)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <div
              className={cn(
                surfaceCard,
                'mt-10 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6'
              )}
            >
              <div>
                <p className="font-display text-base font-semibold text-[var(--fg)]">
                  {t('legal.questionsTitle')}
                </p>
                <p className="mt-1 text-sm text-[var(--fg-muted)]">{t('legal.questionsBody')}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/contact"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110"
                >
                  <SiteIcon name="chat" size={15} />
                  {t('legal.contactUs')}
                </Link>
                <Link
                  to={other.to}
                  className="inline-flex h-10 items-center rounded-full border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] lg:hidden"
                >
                  {other.label}
                </Link>
              </div>
            </div>
          </article>
        </div>
      </Container>
    </>
  )
}
