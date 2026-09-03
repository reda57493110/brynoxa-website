import { Link, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useT } from '@/hooks/useT'

export function AuthLayout() {
  const t = useT()
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
          <Outlet />
        </div>
        <p className="mt-6 text-center text-xs text-[var(--fg-muted)]">
          {t('auth.layoutHint')}
        </p>
      </motion.div>
    </div>
  )
}
