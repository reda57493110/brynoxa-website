import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Container } from '@/components/ui/Container'
import { PageHero } from '@/components/layout/PageHero'
import { surfaceCard } from '@/components/layout/pageStyles'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Skeleton } from '@/components/ui/Skeleton'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { PhoneText } from '@/components/ui/PhoneText'
import { QuickGuide } from '@/components/help/QuickGuide'
import { useSeo } from '@/hooks/useSeo'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { CONTACT } from '@/lib/site'
import { cn } from '@/lib/cn'
import {
  helpGuideQuery,
  searchHelp,
  type HelpFaq,
  type HelpGuide,
  type HelpGuideId,
  type HelpLink,
  type HelpTopic,
} from '@/lib/help'

/**
 * Help Center (/help). Content lives in lib/help/{en,fr,ar}.ts. The page starts with the five
 * step-by-step guides (tabs), then popular questions and all answers (open one at a time), with a
 * search (?q=). Links: /help#order opens a guide, /help#track-order opens and scrolls to an answer.
 */

const scrollMargin = 'scroll-mt-[calc(var(--nav-height)+1rem)]'

const chipLink =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

const iconTile = 'grid shrink-0 place-items-center bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]'

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
  return (
    <div className="text-sm leading-relaxed text-[var(--fg-muted)] sm:text-[15px]">
      <p className="text-[var(--fg)]">{topic.summary}</p>
      {topic.steps?.length ? (
        <ol className="mt-3 space-y-2">
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
      ) : null}
      {topic.points?.length ? (
        <ul className="mt-3 space-y-1.5">
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
}: {
  id: string
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const panelId = useId()
  return (
    <div id={id} className={cn(scrollMargin, 'border-b border-[var(--border)] last:border-b-0')}>
      <h3 className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center gap-3 py-3.5 text-start text-[15px] font-semibold text-[var(--fg)] transition hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:py-4"
        >
          <span className="min-w-0 flex-1">{title}</span>
          <SiteIcon
            name="chevron-down"
            size={18}
            className={cn('text-[var(--fg-muted)] transition-transform duration-200', open && 'rotate-180 text-[var(--brand-text)]')}
          />
        </button>
      </h3>
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
        <span className={cn(iconTile, 'size-11 rounded-full')}>
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
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">{t('help.loading')}</span>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-40 shrink-0 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-3xl" />
    </div>
  )
}

export function Help() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const [open, setOpen] = useState<Set<string>>(() => new Set())
  const [guideId, setGuideId] = useState<HelpGuideId>('order')

  useSeo({ title: t('help.title'), description: t('help.description'), path: '/help' })

  const content = useQuery(helpGuideQuery(locale))
  const results = useMemo(() => (content.data && query.trim() ? searchHelp(content.data, query) : null), [content.data, query])

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // /help#order: show that guide. /help#track-order: open that answer. Then bring it into view.
  useEffect(() => {
    const data = content.data
    if (!data || !location.hash) return
    const id = decodeURIComponent(location.hash.slice(1))
    let target = id
    const guide = data.guides.find((g) => g.id === id)
    if (guide) {
      setGuideId(guide.id)
      target = 'guides'
    } else if (data.sections.some((s) => s.topics.some((tp) => tp.id === id)) || data.faqs.some((f) => f.id === id)) {
      setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    }
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => scrollToId(target)))
    return () => cancelAnimationFrame(frame)
  }, [content.data, location.hash, location.key])

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageHero kicker={t('help.kicker')} title={t('help.heading')} description={t('help.body')}>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="relative max-w-xl">
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
      </PageHero>

      <Container className="pb-12 pt-5 sm:pb-16 sm:pt-8">
        {content.isPending ? (
          <HelpSkeleton />
        ) : content.isError ? (
          <QueryErrorState title={t('help.loadError')} description={t('help.loadErrorBody')} onRetry={() => content.refetch()} />
        ) : results ? (
          <SearchResults query={query} results={results} open={open} toggle={toggle} onClear={() => setQuery('')} />
        ) : (
          <>
            <GuideTabs data={content.data} selected={guideId} onSelect={setGuideId} />
            <Answers data={content.data} open={open} toggle={toggle} />
          </>
        )}

        <div className="mx-auto mt-10 max-w-5xl sm:mt-14">
          <StillNeedHelp />
        </div>
      </Container>
    </>
  )
}

/** The five step-by-step guides as tabs: pick one, its steps show below. */
function GuideTabs({ data, selected, onSelect }: { data: HelpGuide; selected: HelpGuideId; onSelect: (id: HelpGuideId) => void }) {
  const t = useT()
  const tabsRef = useRef<HTMLDivElement>(null)
  const guide = data.guides.find((g) => g.id === selected) ?? data.guides[0]

  // Arrow keys move between tabs (left/right follow the reading direction)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const ids = data.guides.map((g) => g.id)
    const rtl = document.documentElement.dir === 'rtl'
    const i = ids.indexOf(guide.id)
    const step = (e.key === 'ArrowRight') !== rtl ? 1 : -1
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : (i + step + ids.length) % ids.length
    onSelect(ids[next])
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <section id="guides" aria-labelledby="help-guides-title" className={cn(scrollMargin, 'mx-auto max-w-5xl')}>
      <h2 id="help-guides-title" className="font-display text-lg font-semibold text-[var(--fg)] sm:text-xl">
        {t('help.quickTitle')}
      </h2>

      <div
        ref={tabsRef}
        role="tablist"
        aria-labelledby="help-guides-title"
        onKeyDown={onKeyDown}
        className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0"
      >
        {data.guides.map((g) => {
          const active = g.id === guide.id
          return (
            <button
              key={g.id}
              id={`help-tab-${g.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="help-guide-panel"
              tabIndex={active ? 0 : -1}
              onClick={() => onSelect(g.id)}
              className={cn(
                'flex shrink-0 snap-start items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-start text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:flex-col sm:items-start sm:gap-2 sm:p-3.5',
                active
                  ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_8%,var(--bg-elevated))] text-[var(--fg)] shadow-soft'
                  : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg-muted)] hover:border-[var(--brand)] hover:text-[var(--fg)]'
              )}
            >
              <span className={cn(iconTile, 'size-9 rounded-xl', active && 'bg-[var(--brand)] text-[var(--brand-fg)]')}>
                <SiteIcon name={g.icon} size={18} />
              </span>
              {g.title}
            </button>
          )
        })}
      </div>

      <div
        id="help-guide-panel"
        role="tabpanel"
        aria-labelledby={`help-tab-${guide.id}`}
        className={cn(surfaceCard, 'mt-3 p-4 sm:p-6')}
      >
        <h3 className="font-display text-xl font-semibold tracking-tight text-[var(--fg)] sm:text-2xl">{guide.title}</h3>
        <div className="mt-1">
          <QuickGuide guide={guide} wide moreHref={`/help#${guide.more}`} />
        </div>
      </div>
    </section>
  )
}

/** Popular questions, then every answer grouped by subject. */
function Answers({ data, open, toggle }: { data: HelpGuide; open: Set<string>; toggle: (id: string) => void }) {
  const t = useT()
  return (
    <div className="mx-auto mt-10 max-w-5xl space-y-10 sm:mt-14">
      <section id="faq" aria-labelledby="faq-title" className={scrollMargin}>
        <h2 id="faq-title" className="font-display text-lg font-semibold text-[var(--fg)] sm:text-xl">
          {t('help.popularTitle')}
        </h2>
        <div className={cn(surfaceCard, 'mt-3 px-4 sm:px-6')}>
          {data.faqs.map((faq) => (
            <Disclosure key={faq.id} id={faq.id} title={faq.q} open={open.has(faq.id)} onToggle={() => toggle(faq.id)}>
              <FaqAnswer faq={faq} />
            </Disclosure>
          ))}
        </div>
      </section>

      <section aria-labelledby="answers-title">
        <h2 id="answers-title" className="font-display text-lg font-semibold text-[var(--fg)] sm:text-xl">
          {t('help.topicsTitle')}
        </h2>
        <nav aria-label={t('help.topicsTitle')} className="mt-3 flex flex-wrap gap-2">
          {data.sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault()
                scrollToId(s.id, true)
              }}
              className={cn(chipLink, 'h-8 px-3 text-[13px]')}
            >
              <SiteIcon name={s.icon} size={14} className="text-[var(--brand-text)]" />
              {s.title}
            </a>
          ))}
        </nav>
        <div className="mt-6 space-y-6">
          {data.sections.map((section) => (
            <div key={section.id} id={section.id} className={scrollMargin}>
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
                <span className={cn(iconTile, 'size-7 rounded-lg')}>
                  <SiteIcon name={section.icon} size={15} />
                </span>
                {section.title}
              </h3>
              <div className={cn(surfaceCard, 'mt-2 px-4 sm:px-6')}>
                {section.topics.map((topic) => (
                  <Disclosure key={topic.id} id={topic.id} title={topic.title} open={open.has(topic.id)} onToggle={() => toggle(topic.id)}>
                    <TopicBody topic={topic} />
                  </Disclosure>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function SearchResults({
  query,
  results,
  open,
  toggle,
  onClear,
}: {
  query: string
  results: ReturnType<typeof searchHelp>
  open: Set<string>
  toggle: (id: string) => void
  onClear: () => void
}) {
  const t = useT()
  const count = results.topics.length + results.faqs.length
  // While searching, an answer is open unless the reader closed it
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
          <h2 className="mt-3 font-display text-lg font-semibold text-[var(--fg)]">{t('help.noResultsTitle', { q: query.trim() })}</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[var(--fg-muted)]">{t('help.noResultsBody')}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={onClear} className={chipLink}>
              {t('help.allTopics')}
            </button>
            <Link to="/contact" className={chipLink}>
              {t('help.contactPage')}
            </Link>
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
              <p className="-mt-1 mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--brand-text)]">{t('help.popularTitle')}</p>
              <FaqAnswer faq={faq} />
            </Disclosure>
          ))}
        </div>
      )}
    </div>
  )
}
