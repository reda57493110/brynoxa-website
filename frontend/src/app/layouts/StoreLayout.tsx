import { Outlet, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export function StoreLayout() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--fg)]">
      <Navbar />
      {/* No exit fade — mode="wait" + opacity 0 made the page flash black between routes */}
      <motion.main
        key={location.pathname}
        initial={reduceMotion ? false : { opacity: 0.96, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1"
      >
        <Outlet />
      </motion.main>
      <Footer />
    </div>
  )
}
