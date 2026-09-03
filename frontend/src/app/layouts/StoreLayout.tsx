import { useEffect, useLayoutEffect } from 'react'
import { Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppHost } from '@/components/contact/WhatsAppHost'
import { useT } from '@/hooks/useT'

const scrollPositions = new Map<string, number>()

function jumpTo(y: number) {
  const html = document.documentElement
  const previousBehavior = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  window.scrollTo(0, y)
  html.style.scrollBehavior = previousBehavior
}

export function StoreLayout() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const reduceMotion = useReducedMotion()
  const t = useT()

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = previousRestoration
    }
  }, [])

  // Capture the position before the old route is replaced.
  useLayoutEffect(() => {
    return () => {
      scrollPositions.set(location.key, window.scrollY)
    }
  }, [location.key])

  useLayoutEffect(() => {
    if (location.hash) return
    jumpTo(navigationType === 'POP' ? scrollPositions.get(location.key) ?? 0 : 0)
  }, [location.key, location.hash, navigationType])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const savedPosition = scrollPositions.get(location.key) ?? 0

    const restore = () => {
      if (cancelled) return

      const hash = location.hash ? decodeURIComponent(location.hash.slice(1)) : ''
      const target = hash ? document.getElementById(hash) : null
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'auto' })
        return
      }

      // Lazy-loaded pages may still be rendering when this effect runs.
      // Wait briefly if a POP needs a position below the current document height.
      if (
        navigationType === 'POP' &&
        savedPosition > window.innerHeight &&
        document.documentElement.scrollHeight < savedPosition + window.innerHeight &&
        attempts < 12
      ) {
        attempts += 1
        timer = setTimeout(restore, 50)
        return
      }

      jumpTo(navigationType === 'POP' ? savedPosition : 0)
    }

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(restore)
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (timer) clearTimeout(timer)
    }
  }, [location.key, location.hash, navigationType])

  return (
    <div className="flex min-h-screen max-w-full flex-col overflow-x-hidden bg-[var(--bg)] text-[var(--fg)]">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[110] -translate-y-20 rounded-full bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-[var(--brand-fg)] transition focus:translate-y-0"
      >
        {t('common.skipToContent')}
      </a>
      <Navbar />
      {/* No exit fade — mode="wait" + opacity 0 made the page flash black between routes */}
      <motion.main
        key={location.pathname}
        initial={reduceMotion ? false : { opacity: 0.96, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1"
        id="main-content"
      >
        <Outlet />
      </motion.main>
      <Footer />
      <WhatsAppHost />
    </div>
  )
}
