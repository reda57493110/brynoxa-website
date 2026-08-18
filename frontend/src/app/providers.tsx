import { useEffect, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { useThemeStore } from '@/store/themeStore'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { restoreSession } from '@/api/client'
import { wishlistApi } from '@/api/wishlistApi'
import { Toaster } from '@/components/ui/Toaster'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
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
    let cancelled = false

    ;(async () => {
      const token = await restoreSession()
      if (cancelled) return
      if (token) {
        try {
          if (localIds.length) {
            const synced = await wishlistApi.sync(localIds)
            setFromServer(synced.data.data)
          } else {
            const wish = await wishlistApi.list()
            setFromServer(wish.data.data)
          }
        } catch {
          /* wishlist optional */
        }
      }
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
      <BrowserRouter>
        <BootstrapAuth>
          {children}
          <Toaster />
        </BootstrapAuth>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
