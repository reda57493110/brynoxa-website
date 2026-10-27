import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { LazyMotion } from 'framer-motion'
import { routerBasename } from '@/lib/localePath'
import { useThemeStore } from '@/store/themeStore'
import { useLocaleStore } from '@/store/localeStore'
import { useAuthStore } from '@/store/authStore'
import { restoreSession } from '@/api/client'
import { Toaster } from '@/components/ui/Toaster'
import { AnalyticsListener } from '@/components/analytics/AnalyticsListener'

// Animation code arrives after the first paint; elements show their final state until then
const motionFeatures = () => import('@/lib/motionFeatures').then((mod) => mod.default)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

// Signing out or into another account: drop everything cached for the previous one
// (orders, order pages, notifications…) so nothing stale or someone else's shows.
let lastUserId: string | null | undefined
useAuthStore.subscribe((state) => {
  const id = state.user?._id ?? null
  if (lastUserId !== undefined && id !== lastUserId) queryClient.clear()
  lastUserId = id
})

function BootstrapAuth({ children }: { children: ReactNode }) {
  const hydrateTheme = useThemeStore((s) => s.hydrateTheme)
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped)

  useEffect(() => {
    hydrateTheme()
    useLocaleStore.getState().hydrateLocale()
    let cancelled = false

    ;(async () => {
      await restoreSession()
      if (!cancelled) setBootstrapped(true)
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, [])

  return children
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={motionFeatures} strict>
      <BrowserRouter basename={routerBasename()}>
        <BootstrapAuth>
          {children}
          <AnalyticsListener />
          <Toaster />
        </BootstrapAuth>
      </BrowserRouter>
      </LazyMotion>
    </QueryClientProvider>
  )
}
