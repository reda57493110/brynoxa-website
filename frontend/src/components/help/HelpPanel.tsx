import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { QuickGuide, type GuideAction } from '@/components/help/QuickGuide'
import { useT } from '@/hooks/useT'
import { useHelpStore } from '@/store/helpStore'
import { useLocaleStore } from '@/store/localeStore'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { useCartStore } from '@/store/cartStore'
import { helpGuideQuery } from '@/lib/help'
import { searchHelp } from '@/lib/help/search'
import { composeWhatsAppMessage, openWhatsApp as openWhatsAppChat } from '@/lib/whatsapp'
import type { HelpGuide } from '@/lib/help/types'
import { orderStepFor } from '@/lib/help/context'
import { cn } from '@/lib/cn'

/**
 * "Ask a question" in the Help button: the customer types anything (any language, Darija in Arabic
 * or Latin letters, with typos) and sees the best answers right here, each with its short answer
 * and a link to the full one. No answer: one tap sends the question to us on WhatsApp.
 */
function HelpAsk({ guide, onNavigate }: { guide: HelpGuide; onNavigate: () => void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const results = useMemo(() => (query.trim().length >= 2 ? searchHelp(guide, query) : null), [guide, query])
  const answers = results
    ? [
        ...results.topics.slice(0, 3).map(({ topic }) => ({ id: topic.id, title: topic.title, text: topic.summary })),
        ...results.faqs.slice(0, 2).map((f) => ({ id: f.id, title: f.q, text: f.a })),
      ]
    : []
  const ask = () => openWhatsAppChat(composeWhatsAppMessage([t('help.waAsk'), query.trim()]))

  return (
    <div>
      <label htmlFor="help-ask" className="text-sm font-semibold">
        {t('help.askTitle')}
      </label>
      <div className="relative mt-2">
        <SiteIcon name="search" size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
        <input
          id="help-ask"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(null)
          }}
          placeholder={t('help.askPlaceholder')}
          autoComplete="off"
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] pe-3 ps-9 text-sm outline-none transition focus:border-[var(--brand)]"
        />
      </div>
      {results ? (
        answers.length ? (
          <ul className="mt-2.5 space-y-1.5" aria-live="polite">
            {answers.map((a) => {
              const isOpen = open === a.id || (open === null && a.id === answers[0].id)
              return (
                <li key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)]">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? '' : a.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start justify-between gap-2 px-3 py-2.5 text-start text-sm font-semibold"
                  >
                    {a.title}
                    <SiteIcon name="chevron-down" size={15} className={cn('mt-0.5 shrink-0 text-[var(--fg-muted)] transition', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen ? (
                    <div className="px-3 pb-3 text-[13px] leading-relaxed text-[var(--fg-muted)]">
                      <p>{a.text}</p>
                      <Link to={`/help#${a.id}`} onClick={onNavigate} className="mt-1.5 inline-flex items-center gap-1 font-medium text-[var(--brand-text)] hover:underline">
                        {t('help.moreDetails')}
                        <SiteIcon name="arrow-right" size={13} className="rtl:rotate-180" />
                      </Link>
                    </div>
                  ) : null}
                </li>
              )
            })}
            <li className="pt-1 text-center text-xs text-[var(--fg-muted)]">
              {t('help.notThis')}{' '}
              <button type="button" onClick={ask} className="font-semibold text-[var(--brand-text)] hover:underline">
                {t('help.askWhatsApp')}
              </button>
            </li>
          </ul>
        ) : (
          <div className="mt-2.5 rounded-xl border border-dashed border-[var(--border)] p-3 text-center" aria-live="polite">
            <p className="text-sm font-semibold">{t('help.noResultsTitle', { q: query.trim() })}</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{t('help.askNoAnswer')}</p>
            <button
              type="button"
              onClick={ask}
              className="mt-2.5 inline-flex h-10 items-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110"
            >
              <SiteIcon name="chat" size={16} />
              {t('help.askWhatsApp')}
            </button>
          </div>
        )
      ) : null}
    </div>
  )
}

/**
 * The panel opened by the Help button: the list of step-by-step guides, or one guide. A card above
 * the button on computers, a sheet from the bottom on phones. Escape or a tap outside closes it.
 */
export function HelpPanel({ returnFocusTo }: { returnFocusTo: RefObject<HTMLButtonElement | null> }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const isOpen = useHelpStore((s) => s.isOpen)
  const guideId = useHelpStore((s) => s.guide)
  const show = useHelpStore((s) => s.show)
  const close = useHelpStore((s) => s.close)
  const openWhatsApp = useWhatsAppStore((s) => s.open)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)

  const content = useQuery({ ...helpGuideQuery(locale), enabled: isOpen })
  const guide = content.data?.guides.find((g) => g.id === guideId) ?? null
  const { pathname } = useLocation()
  const itemsInCart = useCartStore((s) => s.items.reduce((sum, item) => sum + item.qty, 0))

  // "How to order" follows the shopper: the steps already done are ticked, the button is the next move
  const orderStep = guide?.id === 'order' ? orderStepFor(pathname, itemsInCart) : undefined
  let orderAction: GuideAction | undefined
  if (guide?.id === 'order') {
    if (pathname.startsWith('/checkout')) orderAction = { label: t('help.continueOrder'), onClick: close }
    else if (itemsInCart > 0)
      orderAction = {
        label: itemsInCart === 1 ? t('help.goToCheckoutOne') : t('help.goToCheckout', { n: itemsInCart }),
        to: '/checkout',
      }
    else if (pathname.startsWith('/product/')) orderAction = { label: t('help.backToProduct'), onClick: close }
  }

  // Focus the title when opening or switching guides; give focus back to the Help button when closing
  useEffect(() => {
    if (isOpen) {
      headingRef.current?.focus()
      bodyRef.current?.scrollTo({ top: 0 })
    } else if (wasOpen.current) {
      returnFocusTo.current?.focus()
    }
    wasOpen.current = isOpen
  }, [isOpen, guideId, returnFocusTo])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  if (!isOpen) return null

  return (
    <>
      {/* Phones: a dimmed page behind the sheet; tap it to close */}
      <div className="fixed inset-0 z-[55] bg-black/40 sm:hidden" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-labelledby="help-panel-title"
        className={cn(
          'toast-enter fixed z-[60] flex flex-col overflow-hidden border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] shadow-soft-lg',
          'inset-x-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] max-h-[82svh] rounded-3xl',
          'sm:inset-x-auto sm:end-5 sm:bottom-[4.75rem] sm:max-h-[min(38rem,calc(100svh-7rem))] sm:w-[24rem] sm:rounded-2xl'
        )}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          {guide ? (
            <button
              type="button"
              onClick={() => show(null)}
              aria-label={t('help.backToGuides')}
              className="-ms-1.5 grid size-8 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
            >
              <SiteIcon name="arrow-left" size={17} className="rtl:rotate-180" />
            </button>
          ) : (
            <SiteIcon name="help" size={20} className="text-[var(--brand-text)]" />
          )}
          <div className="min-w-0 flex-1">
            <h2
              id="help-panel-title"
              ref={headingRef}
              tabIndex={-1}
              className="truncate font-display text-base font-semibold outline-none"
            >
              {guide ? guide.title : t('help.heading')}
            </h2>
            {/* The guide's one-line intro stays in view while the steps scroll */}
            {guide ? <p className="line-clamp-2 text-xs leading-snug text-[var(--fg-muted)]">{guide.intro}</p> : null}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t('help.close')}
            className="grid size-8 place-items-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
          >
            <SiteIcon name="close" size={17} />
          </button>
        </div>

        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {content.isPending ? (
            <div className="flex justify-center py-10" role="status" aria-label={t('help.loading')}>
              <Spinner />
            </div>
          ) : content.isError ? (
            <div className="py-6 text-center text-sm">
              <p className="font-semibold">{t('help.loadError')}</p>
              <button type="button" onClick={() => content.refetch()} className="mt-2 font-medium text-[var(--brand-text)] hover:underline">
                {t('common.retry')}
              </button>
            </div>
          ) : guide ? (
            <QuickGuide
              guide={guide}
              onNavigate={close}
              moreHref={`/help#${guide.more}`}
              current={orderStep}
              action={orderAction}
              hideIntro
            />
          ) : (
            <>
              <HelpAsk guide={content.data} onNavigate={close} />
              <p className="mt-4 text-sm text-[var(--fg-muted)]">{t('help.widgetPick')}</p>
              <ul className="mt-3 space-y-2">
                {content.data.guides.map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      onClick={() => show(g.id)}
                      className="group flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-3 text-start transition hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)]">
                        <SiteIcon name={g.icon} size={19} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold group-hover:text-[var(--brand-text)]">{g.title}</span>
                        <span className="mt-0.5 block text-xs leading-snug text-[var(--fg-muted)]">{g.intro}</span>
                      </span>
                      <SiteIcon name="chevron-right" size={16} className="text-[var(--fg-muted)] rtl:rotate-180" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--bg)] px-4 py-3">
          <button
            type="button"
            onClick={() => {
              close()
              openWhatsApp()
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-[13px] font-medium transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <SiteIcon name="chat" size={15} className="text-[var(--brand-text)]" />
            {t('help.chatWhatsApp')}
          </button>
          <Link to="/help" onClick={close} className="text-[13px] font-medium text-[var(--brand-text)] hover:underline">
            {t('help.openCenter')}
          </Link>
        </div>
      </div>
    </>
  )
}
