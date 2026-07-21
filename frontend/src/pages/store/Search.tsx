import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'

export function Search() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''

  const products = useQuery({
    queryKey: ['products', 'search', q],
    queryFn: async () => (await productsApi.list({ q, limit: 24 })).data.data,
    enabled: Boolean(q),
  })

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl font-semibold">Search</h1>
      <p className="mt-1 text-sm text-[var(--fg-muted)]">
        {q ? (
          <>
            Results for <span className="text-[var(--fg)]">“{q}”</span>
          </>
        ) : (
          'Enter a query in the search bar'
        )}
      </p>
      {!q ? (
        <Link to="/shop" className="mt-6 inline-block text-[var(--brand)]">
          Browse shop
        </Link>
      ) : (
        <div className="mt-8">
          <ProductGrid products={products.data} loading={products.isLoading} />
        </div>
      )}
    </Container>
  )
}
