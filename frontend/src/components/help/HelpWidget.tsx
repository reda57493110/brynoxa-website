import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { useHelpStore } from '@/store/helpStore'
import { guideForPath } from '@/lib/help/context'
import { cn } from '@/lib/cn'

const HelpPanel = lazy(() => import('./HelpPanel').then((m) => ({ default: m.HelpPanel })))

/** Pages with a sticky bar at the bottom on phones: the button sits above it. */
const hasPhoneBottomBar = (pathname: string) =>
  pathname === '/cart' || pathname === '/checkout' || pathname.startsWith('/product/')

/**
 * The Help button on every shop page. It opens the step-by-step guide for the page the customer is
 * on (cart → how to order, my orders → how to track…), or the list of guides. The panel and the
 * guide text are only downloaded the first time it is opened.
 */
export function HelpWidget() {
  const t = useT()
  const { pathname } = useLocation()
  const isOpen = useHelpStore((s) => s.isOpen)
  const open = useHelpStore((s) => s.open)
  const close = useHelpStore((s) => s.close)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (isOpen) setLoaded(true)
  }, [isOpen])

  // A new page: close the panel
  useEffect(() => {
    close()
  }, [pathname, close])

  // Phones: the button shows at the top of a page and fades away once the customer scrolls into the
  // content, so it never covers a button they want to tap (help stays in the menu and the page links)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 160)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [pathname])

  // The Help Center page is the full version of this panel
  if (pathname === '/help') return null

  const lifted = hasPhoneBottomBar(pathname)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? close() : open(guideForPath(pathname)))}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={t('help.widgetOpen')}
        className={cn(
          // phones: a small round “?”; larger screens: “? Help”
          'fixed end-3 z-40 inline-flex size-11 items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--fg)] shadow-soft-lg transition-all duration-200 hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:end-5 sm:bottom-5 sm:h-12 sm:w-auto sm:ps-3 sm:pe-3.5',
          lifted ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]' : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]',
          isOpen && 'border-[var(--brand)] text-[var(--brand-text)]',
          scrolled && !isOpen && 'max-sm:invisible max-sm:translate-y-3 max-sm:opacity-0'
        )}
      >
        <SiteIcon name={isOpen ? 'close' : 'help'} size={20} className="text-[var(--brand-text)]" />
        <span className="hidden sm:inline">{t('help.widgetButton')}</span>
      </button>

      {loaded ? (
        <Suspense fallback={null}>
          <HelpPanel returnFocusTo={buttonRef} />
        </Suspense>
      ) : null}
    </>
  )
}
