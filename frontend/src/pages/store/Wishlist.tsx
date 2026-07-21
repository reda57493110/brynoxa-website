import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import { wishlistApi } from '@/api/wishlistApi'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useNavigate } from 'react-router-dom'

export function Wishlist() {
  const navigate = useNavigate()
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  const bootstrapped = useAuthStore((s) => s.bootstrapped)
  const ids = useWishlistStore((s) => s.ids)
  const setFromServer = useWishlistStore((s) => s.setFromServer)
  const productsLocal = useWishlistStore((s) => s.products)

  const remote = useQuery({
    queryKey: ['wishlist'],
    queryFn: async () => (await wishlistApi.list()).data.data,
    enabled: isAuth && bootstrapped,
  })

  useEffect(() => {
    if (remote.data) setFromServer(remote.data)
  }, [remote.data, setFromServer])

  const localProducts = useQuery({
    queryKey: ['wishlist-local', ids],
    queryFn: async () => {
      if (!ids.length) return []
      const res = await productsApi.compare(ids)
      return res.data.data
    },
    enabled: !isAuth && ids.length > 0,
  })

  const products = isAuth ? remote.data || productsLocal : localProducts.data
  const loading = isAuth ? remote.isLoading : localProducts.isLoading

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl font-semibold">Wishlist</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        {isAuth ? 'Synced to your account' : 'Saved on this device — sign in to sync'}
      </p>
      <div className="mt-8">
        {!loading && !products?.length ? (
          <EmptyState
            icon={Heart}
            title="No saved items"
            description="Tap the heart on products you love."
            actionLabel="Browse shop"
            onAction={() => navigate('/shop')}
          />
        ) : (
          <ProductGrid products={products} loading={loading} />
        )}
      </div>
    </Container>
  )
}
