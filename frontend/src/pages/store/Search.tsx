import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

export function Search() {
  const t = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = params.get('q') || ''

  usePageTitle(q ? t('search.titleQ', { q }) : t('search.title'))

  const products = useQuery({
    queryKey: ['products', 'search', q],
    queryFn: async () => (await productsApi.list({ q, limit: 24 })).data.data,
    enabled: Boolean(q),
  })

  const resultCount = products.data?.length ?? 0

  return (
    <>
      <PageHero
        kicker={t('search.kicker')}
        title={t('search.heading')}
        description={q ? t('shop.resultsFor', { q }) : t('search.emptyNav')}
      />
      <Container className="py-8 sm:py-10">
        {!q ? (
          <EmptyState
            icon="search"
            title={t('search.emptyTitle')}
            description={t('search.emptyNav')}
            actionLabel={t('home.browseShop')}
            onAction={() => navigate('/shop')}
          />
        ) : (
          <>
            <p className="mb-5 text-sm text-[var(--fg-muted)]">
              {products.isLoading
                ? t('ui.searching')
                : resultCount === 1
                  ? t('search.resultOne', { count: resultCount })
                  : t('search.results', { count: resultCount })}
            </p>
            <ProductGrid
              products={products.data}
              loading={products.isLoading}
              emptyTitle={t('search.noMatch')}
              emptyDescription={t('search.noMatchBody')}
              emptyActionLabel={t('home.browseShop')}
              emptyActionTo="/shop"
            />
          </>
        )}
      </Container>
    </>
  )
}
