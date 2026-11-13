import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { useT } from '@/hooks/useT'
import { applyConsent, trackingWanted } from '@/lib/analytics'
import { onConsentOpen, readConsent, saveConsent } from '@/lib/consent'

/**
 * Shop pages: asks once whether measurement / advertising cookies may be used (Google Analytics,
 * Meta Pixel, TikTok Pixel). Only shown when the shop has one of them configured; nothing of theirs
 * loads before "Accept". "Refuse" is as easy as "Accept". The footer's "Cookie settings" reopens it.
 */
export function CookieBanner() {
  const t = useT()
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
    staleTime: 60_000,
  })
  const [asked, setAsked] = useState(() => readConsent() !== null)
  const [reopened, setReopened] = useState(false)
  useEffect(() => onConsentOpen(() => setReopened(true)), [])

  const wanted = settings.data ? trackingWanted(settings.data.tracking) : false
  if (!reopened && (asked || !wanted)) return null

  const choose = (choice: 'granted' | 'denied') => {
    saveConsent(choice)
    if (choice === 'granted') applyConsent()
    setAsked(true)
    setReopened(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('consent.title')}
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-2xl sm:inset-x-auto sm:start-4 sm:bottom-4"
    >
      <p className="text-sm font-semibold">{t('consent.title')}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
        {t('consent.body')}{' '}
        <Link to="/privacy" className="font-medium text-[var(--brand-text)] underline-offset-2 hover:underline">
          {t('consent.more')}
        </Link>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => choose('denied')}
          className="h-10 rounded-full border border-[var(--border)] text-sm font-semibold transition hover:border-[var(--brand)]"
        >
          {t('consent.refuse')}
        </button>
        <button
          type="button"
          onClick={() => choose('granted')}
          className="h-10 rounded-full border border-[var(--border)] text-sm font-semibold transition hover:border-[var(--brand)]"
        >
          {t('consent.accept')}
        </button>
      </div>
    </div>
  )
}
