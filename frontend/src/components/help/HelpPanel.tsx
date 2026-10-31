import { useEffect, useRef, type RefObject } from 'react'
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
import { orderStepFor } from '@/lib/help/context'
import { cn } from '@/lib/cn'

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
              <p className="text-sm text-[var(--fg-muted)]">{t('help.widgetPick')}</p>
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
