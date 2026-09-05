import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useLocaleStore } from '@/store/localeStore'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { restoreSession } from '@/api/client'
import { wishlistApi } from '@/api/wishlistApi'
import { Toaster } from '@/components/ui/Toaster'

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

function BootstrapAuth({ children }: { children: ReactNode }) {
  const hydrateTheme = useThemeStore((s) => s.hydrateTheme)
  const setBootstrapped = useAuthStore((s) => s.setBootstrapped)
  const localIds = useWishlistStore((s) => s.ids)
  const setFromServer = useWishlistStore((s) => s.setFromServer)

  useEffect(() => {
    hydrateTheme()
    useLocaleStore.getState().hydrateLocale()
    let cancelled = false

    ;(async () => {
      const token = await restoreSession()
      if (cancelled) return
      // Unlock routing immediately — wishlist is storefront-only and must not block /admin.
      setBootstrapped(true)
      if (!token) return
      try {
        if (localIds.length) {
          const synced = await wishlistApi.sync(localIds)
          if (!cancelled) setFromServer(synced.data.data)
        } else {
          const wish = await wishlistApi.list()
          if (!cancelled) setFromServer(wish.data.data)
        }
      } catch {
        /* wishlist optional */
      }
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
      <BrowserRouter>
        <BootstrapAuth>
          {children}
          <Toaster />
        </BootstrapAuth>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
