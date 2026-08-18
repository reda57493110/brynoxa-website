import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { wishlistApi } from '@/api/wishlistApi'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { useAuthStore } from '@/store/authStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { usePageTitle } from '@/hooks/usePageTitle'

export function Wishlist() {
  usePageTitle('Wishlist — Brynoxa')
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
    <>
      <PageHero
        kicker="Wishlist"
        title="Wishlist"
        description={
          isAuth
            ? 'Saved to your account.'
            : 'Saved on this device. Sign in to keep the list on other phones.'
        }
      />
      <Container className="py-8 sm:py-10">
        {!loading && !products?.length ? (
          <EmptyState
            icon="heart"
            title="No saved items"
            description="Tap the heart on a product to save it here."
            actionLabel="Browse shop"
            onAction={() => navigate('/shop')}
          />
        ) : (
          <ProductGrid products={products} loading={loading} />
        )}
      </Container>
    </>
  )
}
