import { Link, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 18% 12%, color-mix(in srgb, var(--brand) 20%, transparent), transparent 58%), radial-gradient(ellipse 60% 40% at 88% 88%, color-mix(in srgb, var(--fg-muted) 14%, transparent), transparent)',
        }}
      />
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
          Morocco · cash on delivery · 6-month warranty
        </p>
      </motion.div>
    </div>
  )
}
