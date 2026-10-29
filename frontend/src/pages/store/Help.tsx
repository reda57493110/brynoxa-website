import { useCallback, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Skeleton } from '@/components/ui/Skeleton'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { PhoneText } from '@/components/ui/PhoneText'
import { useSeo } from '@/hooks/useSeo'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { CONTACT } from '@/lib/site'
import { cn } from '@/lib/cn'
import { loadHelpGuide, searchHelp, type HelpFaq, type HelpGuide, type HelpLink, type HelpTopic } from '@/lib/help'

/**
 * Help Center (/help): the customer guide. Content lives in lib/help/{en,fr,ar}.ts; this page adds
 * search (?q=), a table of contents, and one-at-a-time readable topics (accordions). Any topic or
 * section can be linked directly: /help#track-order opens and scrolls to it.
 */

const scrollMargin = 'scroll-mt-[calc(var(--nav-height)+1rem)]'

const chipLink =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

/** Arriving from a link: jump straight there. Clicking inside the page: a short smooth scroll. */
function scrollToId(id: string, smooth = false) {
  const el = document.getElementById(id)
  if (!el) return false
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  el.scrollIntoView({ block: 'start', behavior: smooth && !reduce ? 'smooth' : 'instant' })
  return true
}

function TopicLinks({ links }: { links?: HelpLink[] }) {
  if (!links?.length) return null
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((link) => (
        <Link key={link.to + link.label} to={link.to} className={cn(chipLink, 'h-8 px-3 text-[13px]')}>
          {link.label}
          <SiteIcon name="arrow-right" size={13} className="rtl:rotate-180" />
        </Link>
      ))}
    </div>
  )
}

function TopicBody({ topic }: { topic: HelpTopic }) {
  const t = useT()
  return (
    <div className="text-sm leading-relaxed text-[var(--fg-muted)] sm:text-[15px]">
      <p className="text-[var(--fg)]">{topic.summary}</p>
      {topic.steps?.length ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-text)]">{t('help.stepByStep')}</p>
          <ol className="mt-2.5 space-y-2.5">
            {topic.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span
                  className="grid size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-xs font-bold text-[var(--brand-text)]"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {topic.points?.length ? (
        <ul className="mt-4 space-y-2">
          {topic.points.map((point) => (
            <li key={point} className="flex gap-2.5">
              <SiteIcon name="check" size={15} className="mt-[3px] text-[var(--brand-text)]" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <TopicLinks links={topic.links} />
    </div>
  )
}

/** One question you can open and close (button + panel, keyboard friendly). */
function Disclosure({
  id,
  title,
  open,
  onToggle,
  children,
  headingLevel = 3,
}: {
  id: string
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
  headingLevel?: 3 | 4
}) {
  const panelId = useId()
  const Heading = headingLevel === 3 ? 'h3' : 'h4'
  return (
    <div id={id} className={cn(scrollMargin, 'border-b border-[var(--border)] last:border-b-0')}>
      <Heading className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 py-3.5 text-start font-display text-[15px] font-semibold text-[var(--fg)] transition hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:py-4 sm:text-base"
        >
          <span className="min-w-0 flex-1">{title}</span>
          <SiteIcon
            name="chevron-down"
            size={18}
            className={cn('text-[var(--fg-muted)] transition-transform duration-200', open && 'rotate-180 text-[var(--brand-text)]')}
          />
        </button>
      </Heading>
      <div id={panelId} hidden={!open} className="pb-5">
        {children}
      </div>
    </div>
  )
}

function FaqAnswer({ faq }: { faq: HelpFaq }) {
  return (
    <div className="text-sm leading-relaxed text-[var(--fg-muted)] sm:text-[15px]">
      <p>{faq.a}</p>
      <TopicLinks links={faq.links} />
    </div>
  )
}

function StillNeedHelp() {
  const t = useT()
  const openWhatsApp = useWhatsAppStore((s) => s.open)
  return (
    <section
      aria-labelledby="help-still"
      className={cn(surfaceCard, 'flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6')}
    >
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
          <SiteIcon name="chat" size={20} />
        </span>
        <div>
          <h2 id="help-still" className="font-display text-lg font-semibold text-[var(--fg)]">
            {t('help.stillNeedHelp')}
          </h2>
          <p className="mt-1 max-w-md text-sm text-[var(--fg-muted)]">{t('help.stillNeedHelpBody')}</p>
          <p className="mt-1.5 text-xs text-[var(--fg-muted)]">{t('contact.hoursValue')}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          onClick={() => openWhatsApp()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          <SiteIcon name="chat" size={16} />
          {t('help.chatWhatsApp')}
        </button>
        <a href={CONTACT.phone.href} className={cn(chipLink, 'h-10')}>
          <SiteIcon name="phone" size={15} />
          <PhoneText>{CONTACT.phone.value}</PhoneText>
        </a>
        <Link to="/contact" className={cn(chipLink, 'h-10')}>
          <SiteIcon name="mail" size={15} />
          {t('help.contactPage')}
        </Link>
      </div>
    </section>
  )
}

function HelpSkeleton() {
  const t = useT()
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">{t('help.loading')}</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

export function Help() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const location = useLocation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [open, setOpen] = useState<Set<string>>(() => new Set())

  useSeo({ title: t('help.title'), description: t('help.description'), path: '/help' })

  const guide = useQuery({
    queryKey: ['help-guide', locale],
    queryFn: () => loadHelpGuide(locale),
    staleTime: Infinity,
  })

  const results = useMemo(() => (guide.data && query.trim() ? searchHelp(guide.data, query) : null), [guide.data, query])

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // /help#track-order (from other pages or the contents): open that topic and bring it into view
  useEffect(() => {
    if (!guide.data || !location.hash) return
    const id = decodeURIComponent(location.hash.slice(1))
    const isTopic = guide.data.sections.some((s) => s.topics.some((tp) => tp.id === id)) || guide.data.faqs.some((f) => f.id === id)
    if (isTopic) setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => scrollToId(id)))
    return () => cancelAnimationFrame(frame)
  }, [guide.data, location.hash, location.key])

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  /** Contents / topic cards: leave search, then go to the section (works when clicking the same one twice). */
  const goTo = (id: string) => {
    navigate({ pathname: '/help', search: '', hash: id }, { replace: true })
    requestAnimationFrame(() => scrollToId(id, true))
  }

  const quickLinks: { to: string; label: string; icon: SiteIconName }[] = [
    { to: '/shop', label: t('help.quickShop'), icon: 'search' },
    { to: '/account/orders', label: t('help.quickOrders'), icon: 'package' },
    { to: '/track-order', label: t('help.quickTrack'), icon: 'truck' },
    { to: '/contact', label: t('help.quickContact'), icon: 'chat' },
  ]

  return (
    <>
      <PageHero kicker={t('help.kicker')} title={t('help.heading')} description={t('help.body')}>
        <form
          role="search"
          onSubmit={(e) => e.preventDefault()}
          className="relative max-w-xl"
        >
          <label htmlFor="help-search" className="sr-only">
            {t('help.searchLabel')}
          </label>
          <SiteIcon
            name="search"
            size={18}
            className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]"
          />
          <input
            id="help-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('help.searchPlaceholder')}
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-full border border-[var(--border)] bg-[var(--bg-input)] pe-12 ps-11 text-base text-[var(--fg)] shadow-soft outline-none transition placeholder:text-[var(--fg-muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand)_25%,transparent)] [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label={t('help.clearSearch')}
              className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
            >
              <SiteIcon name="close" size={16} />
            </button>
          ) : null}
        </form>
        <nav aria-label={t('help.kicker')} className="mt-4 flex flex-wrap gap-2">
          {quickLinks.map((link) => (
            <Link key={link.to} to={link.to} className={chipLink}>
              <SiteIcon name={link.icon} size={15} className="text-[var(--brand-text)]" />
              {link.label}
            </Link>
          ))}
        </nav>
      </PageHero>

      <Container className="pb-12 pt-5 sm:pb-16 sm:pt-8">
        {guide.isPending ? (
          <HelpSkeleton />
        ) : guide.isError ? (
          <QueryErrorState
            title={t('help.loadError')}
            description={t('help.loadErrorBody')}
            onRetry={() => guide.refetch()}
          />
        ) : results ? (
          <SearchResults
            guide={guide.data}
            query={query}
            results={results}
            open={open}
            toggle={toggle}
            onClear={() => setQuery('')}
          />
        ) : (
          <GuideView guide={guide.data} open={open} toggle={toggle} goTo={goTo} />
        )}

        <div className="mt-10 sm:mt-14">
          <StillNeedHelp />
        </div>
      </Container>
    </>
  )
}

function SearchResults({
  guide,
  query,
  results,
  open,
  toggle,
  onClear,
}: {
  guide: HelpGuide
  query: string
  results: ReturnType<typeof searchHelp>
  open: Set<string>
  toggle: (id: string) => void
  onClear: () => void
}) {
  const t = useT()
  const count = results.topics.length + results.faqs.length
  // While searching, a topic is open unless the reader closed it
  const isOpen = (id: string) => !open.has(`closed:${id}`)
  const flip = (id: string) => toggle(`closed:${id}`)

  return (
    <div className="mx-auto max-w-3xl">
      <p aria-live="polite" className="text-sm font-medium text-[var(--fg-muted)]">
        {count === 1 ? t('help.resultOne', { q: query.trim() }) : t('help.results', { count, q: query.trim() })}
      </p>

      {count === 0 ? (
        <div className={cn(surfaceCard, 'mt-4 p-6 text-center sm:p-8')}>
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
            <SiteIcon name="help" size={22} />
          </span>
          <h2 className="mt-3 font-display text-lg font-semibold text-[var(--fg)]">
            {t('help.noResultsTitle', { q: query.trim() })}
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--fg-muted)]">{t('help.noResultsBody')}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onClear} className={chipLink}>
              {t('help.allTopics')}
            </button>
            <Link to="/contact" className={chipLink}>
              {t('help.quickContact')}
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {guide.sections.map((s) => (
              <Link key={s.id} to={`/help#${s.id}`} className="text-sm font-medium text-[var(--brand-text)] hover:underline">
                {s.title}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className={cn(surfaceCard, 'mt-4 px-4 sm:px-6')}>
          {results.topics.map(({ section, topic }) => (
            <Disclosure key={topic.id} id={topic.id} title={topic.title} open={isOpen(topic.id)} onToggle={() => flip(topic.id)}>
              <p className="-mt-1 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--brand-text)]">{section.title}</p>
              <TopicBody topic={topic} />
            </Disclosure>
          ))}
          {results.faqs.map((faq) => (
            <Disclosure key={faq.id} id={faq.id} title={faq.q} open={isOpen(faq.id)} onToggle={() => flip(faq.id)}>
              <p className="-mt-1 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--brand-text)]">{t('help.faqTitle')}</p>
              <FaqAnswer faq={faq} />
            </Disclosure>
          ))}
        </div>
      )}
    </div>
  )
}

function GuideView({
  guide,
  open,
  toggle,
  goTo,
}: {
  guide: HelpGuide
  open: Set<string>
  toggle: (id: string) => void
  goTo: (id: string) => void
}) {
  const t = useT()
  const contents = [...guide.sections.map((s) => ({ id: s.id, title: s.title })), { id: 'faq', title: t('help.faqTitle') }]

  return (
    <>
      {/* Topic cards: the quickest way in, on every screen */}
      <section id="topics" aria-labelledby="help-browse" className={scrollMargin}>
        <h2 id="help-browse" className="font-display text-lg font-semibold text-[var(--fg)] sm:text-xl">
          {t('help.browseTitle')}
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
          {guide.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  goTo(section.id)
                }}
                className={cn(
                  surfaceCard,
                  'group flex h-full flex-col gap-2 p-3.5 transition hover:-translate-y-0.5 hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:p-4'
                )}
              >
                <span className="grid size-9 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
                  <SiteIcon name={section.icon} size={18} />
                </span>
                <span className="font-display text-sm font-semibold leading-snug text-[var(--fg)] group-hover:text-[var(--brand-text)] sm:text-[15px]">
                  {section.title}
                </span>
                <span className="text-xs text-[var(--fg-muted)]">{section.topics.length === 1 ? t('help.topicOne') : t('help.topicsCount', { count: section.topics.length })}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 grid gap-8 sm:mt-12 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label={t('help.contents')} className="sticky top-[calc(var(--nav-height)+1.5rem)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{t('help.contents')}</p>
            <ul className="mt-3 space-y-1 border-s border-[var(--border)]">
              {contents.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      goTo(item.id)
                    }}
                    className="-ms-px block border-s-2 border-transparent py-1 ps-3 text-sm text-[var(--fg-muted)] transition hover:border-[var(--brand)] hover:text-[var(--fg)]"
                  >
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 space-y-8 sm:space-y-10">
          {guide.sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className={scrollMargin}>
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
                  <SiteIcon name={section.icon} size={20} />
                </span>
                <div className="min-w-0">
                  <h2 id={`${section.id}-title`} className="font-display text-xl font-semibold tracking-tight text-[var(--fg)] sm:text-2xl">
                    {section.title}
                  </h2>
                  <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{section.description}</p>
                </div>
              </div>
              <div className={cn(surfaceCard, 'mt-4 px-4 sm:px-6')}>
                {section.topics.map((topic) => (
                  <Disclosure key={topic.id} id={topic.id} title={topic.title} open={open.has(topic.id)} onToggle={() => toggle(topic.id)}>
                    <TopicBody topic={topic} />
                  </Disclosure>
                ))}
              </div>
              <a
                href="#topics"
                onClick={(e) => {
                  e.preventDefault()
                  goTo('topics')
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--fg-muted)] hover:text-[var(--brand-text)] lg:hidden"
              >
                <SiteIcon name="arrow-up" size={13} />
                {t('help.allTopics')}
              </a>
            </section>
          ))}

          <section id="faq" aria-labelledby="faq-title" className={scrollMargin}>
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
                <SiteIcon name="help" size={20} />
              </span>
              <h2 id="faq-title" className="pt-1.5 font-display text-xl font-semibold tracking-tight text-[var(--fg)] sm:text-2xl">
                {t('help.faqTitle')}
              </h2>
            </div>
            <div className={cn(surfaceCard, 'mt-4 px-4 sm:px-6')}>
              {guide.faqs.map((faq) => (
                <Disclosure key={faq.id} id={faq.id} title={faq.q} open={open.has(faq.id)} onToggle={() => toggle(faq.id)}>
                  <FaqAnswer faq={faq} />
                </Disclosure>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
