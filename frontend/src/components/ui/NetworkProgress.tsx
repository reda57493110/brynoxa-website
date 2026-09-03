import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useNetworkStore } from '@/store/networkStore'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'

function isCatalogPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/shop') ||
    pathname.startsWith('/product/') ||
    pathname.startsWith('/category/') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/wishlist') ||
    pathname.startsWith('/compare')
  )
}

export function NetworkProgress() {
  const pending = useNetworkStore((s) => s.pending)
  const location = useLocation()
  const t = useT()
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    if (pending <= 0 || !isCatalogPath(location.pathname)) {
      setShowBadge(false)
      return
    }
    const timer = window.setTimeout(() => setShowBadge(true), 900)
    return () => window.clearTimeout(timer)
  }, [pending, location.pathname])

  if (pending <= 0) return null

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5 overflow-hidden" aria-hidden>
        <div className="h-full w-1/3 animate-[network-bar_0.9s_ease-in-out_infinite] rounded-full bg-[var(--brand)]" />
      </div>
      {showBadge ? (
        <div
          className="fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3.5 py-2 shadow-soft"
          role="status"
          aria-live="polite"
        >
          <span className="relative flex h-7 w-7 items-center justify-center">
            <Spinner size="sm" className="absolute inset-0 h-7 w-7" />
            <SiteIcon name="package" size={12} className="text-[var(--brand-text)]" />
          </span>
          <span className="text-sm font-medium text-[var(--fg)]">{t('ui.loadingProducts')}</span>
        </div>
      ) : null}
    </>
  )
}
