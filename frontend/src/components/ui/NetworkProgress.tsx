import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useNetworkStore } from '@/store/networkStore'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'

export function NetworkProgress() {
  const pending = useNetworkStore((s) => s.pending)
  const location = useLocation()
  const t = useT()
  const [routeBusy, setRouteBusy] = useState(false)
  const [showBadge, setShowBadge] = useState(false)

  useEffect(() => {
    setRouteBusy(true)
    const hide = window.setTimeout(() => setRouteBusy(false), 450)
    return () => window.clearTimeout(hide)
  }, [location.key])

  const active = pending > 0 || routeBusy

  useEffect(() => {
    if (pending <= 0) {
      setShowBadge(false)
      return
    }
    const timer = window.setTimeout(() => setShowBadge(true), 400)
    return () => window.clearTimeout(timer)
  }, [pending])

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-1 overflow-hidden"
        aria-hidden={!active}
      >
        {active ? (
          <div className="h-full w-1/3 animate-[network-bar_1.1s_ease-in-out_infinite] rounded-full bg-[var(--brand)] shadow-glow" />
        ) : null}
      </div>
      {showBadge ? (
        <div
          className="fixed bottom-5 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/95 px-3.5 py-2 shadow-soft backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          <span className="relative flex h-8 w-8 items-center justify-center">
            <Spinner className="absolute inset-0 h-8 w-8" />
            <SiteIcon name="package" size={14} className="text-[var(--brand-text)]" />
          </span>
          <span className="text-sm font-medium text-[var(--fg)]">{t('ui.loadingProducts')}</span>
        </div>
      ) : null}
    </>
  )
}
