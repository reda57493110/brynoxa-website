import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { usePageTitle } from '@/hooks/usePageTitle'

export function Search() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const q = params.get('q') || ''

  usePageTitle(q ? `Search “${q}” — Brynoxa` : 'Search — Brynoxa')

  const products = useQuery({
    queryKey: ['products', 'search', q],
    queryFn: async () => (await productsApi.list({ q, limit: 24 })).data.data,
    enabled: Boolean(q),
  })

  return (
    <>
      <PageHero
        kicker="Search"
        title="Search"
        description={
          q ? (
            <>
              Results for <span className="font-medium text-[var(--fg)]">“{q}”</span>
            </>
          ) : (
            'Use the search field in the nav, or open the shop.'
          )
        }
      />
      <Container className="py-8 sm:py-10">
        {!q ? (
          <EmptyState
            icon="search"
            title="Nothing to search yet"
            description="Use the search field in the nav, or open the shop."
            actionLabel="Browse shop"
            onAction={() => navigate('/shop')}
          />
        ) : (
          <>
            <p className="mb-5 text-sm text-[var(--fg-muted)]">
              {products.isLoading
                ? 'Searching…'
                : `${products.data?.length ?? 0} result${(products.data?.length ?? 0) === 1 ? '' : 's'}`}
            </p>
            <ProductGrid
              products={products.data}
              loading={products.isLoading}
              emptyTitle="No matches"
              emptyDescription="Try a shorter query or browse by category."
              emptyActionLabel="Browse shop"
              emptyActionTo="/shop"
            />
          </>
        )}
      </Container>
    </>
  )
}
