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
import { useT } from '@/hooks/useT'

export function Wishlist() {
  const t = useT()
  usePageTitle(t('wishlist.title'))
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
        kicker={t('wishlist.kicker')}
        title={t('wishlist.heading')}
        description={isAuth ? t('wishlist.signedIn') : t('wishlist.guest')}
      />
      <Container className="py-8 sm:py-10">
        {!loading && !products?.length ? (
          <EmptyState
            icon="heart"
            title={t('wishlist.emptyTitle')}
            description={t('wishlist.emptyBody')}
            actionLabel={t('home.browseShop')}
            onAction={() => navigate('/shop')}
          />
        ) : (
          <ProductGrid products={products} loading={loading} />
        )}
      </Container>
    </>
  )
}
