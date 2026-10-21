import { useMemo, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useT } from '@/hooks/useT'

/** Pages can hide the shop slogan under the card (e.g. the 2-step security check). */
export type AuthLayoutContext = { setHideHint: (hide: boolean) => void }

export function AuthLayout() {
  const t = useT()
  const [hideHint, setHideHint] = useState(false)
  // Stable, so pages can depend on it without redrawing in a loop
  const outlet = useMemo<AuthLayoutContext>(() => ({ setHideHint }), [])
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link
          to="/"
          className="mb-8 block text-center font-display text-3xl font-bold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        >
          Brynox<span className="text-[var(--brand)]">a</span>
        </Link>
        <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-soft-lg sm:p-8">
          <Outlet context={outlet} />
        </div>
        {!hideHint ? <p className="mt-6 text-center text-xs text-[var(--fg-muted)]">{t('auth.layoutHint')}</p> : null}
      </motion.div>
    </div>
  )
}
