import { Link, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'

export function AuthLayout() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--bg)] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 20% 20%, color-mix(in srgb, var(--brand) 22%, transparent), transparent), radial-gradient(ellipse 60% 40% at 80% 80%, color-mix(in srgb, #3d4a56 35%, transparent), transparent)',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <Link to="/" className="mb-8 block text-center font-display text-3xl font-bold">
          Brynox<span className="text-[var(--brand)]">a</span>
        </Link>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-soft-lg sm:p-8">
          <Outlet />
        </div>
      </motion.div>
    </div>
  )
}
