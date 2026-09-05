import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { wishlistApi } from '@/api/wishlistApi'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { SiteIcon } from '@/components/ui/SiteIcon'
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
  const loading = isAuth
    ? remote.isPending || remote.isFetching
    : ids.length > 0 && (localProducts.isPending || localProducts.isFetching)
  const count = products?.length ?? 0
  const isError = isAuth ? remote.isError : localProducts.isError

  return (
    <>
      <PageHero
        kicker={t('wishlist.kicker')}
        title={t('wishlist.heading')}
        description={isAuth ? t('wishlist.signedIn') : t('wishlist.guest')}
      >
        <div className="flex flex-wrap items-center gap-2">
          {!loading && count > 0 ? (
            <span className="inline-flex h-8 items-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg)]">
              {t('wishlist.count', { count })}
            </span>
          ) : null}
          {!isAuth ? (
            <Link
              to="/login"
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--brand-text)] transition hover:border-[var(--brand)]"
            >
              <SiteIcon name="user" size={14} />
              {t('common.signIn')}
            </Link>
          ) : null}
          <Link
            to="/shop"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            {t('home.browseShop')}
            <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
          </Link>
        </div>
      </PageHero>

      <Container className="py-5 sm:py-10">
        {isError ? (
          <EmptyState
            title={t('wishlist.loadError')}
            description={t('wishlist.loadErrorBody')}
            actionLabel={t('common.retry')}
            onAction={() => (isAuth ? remote.refetch() : localProducts.refetch())}
          />
        ) : !loading && !products?.length ? (
          <EmptyState
            icon="heart"
            title={t('wishlist.emptyTitle')}
            description={t('wishlist.emptyBody')}
            actionLabel={t('home.browseShop')}
            onAction={() => navigate('/shop')}
          />
        ) : (
          <ProductGrid
            products={products}
            loading={loading}
            className="grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          />
        )}
      </Container>
    </>
  )
}
