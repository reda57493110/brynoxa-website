import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/api/categoriesApi'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { Spinner } from '@/components/ui/Spinner'

export function CategoryPage() {
  const { slug = '' } = useParams()
  const category = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => (await categoriesApi.getBySlug(slug)).data.data,
    enabled: Boolean(slug),
  })
  const products = useQuery({
    queryKey: ['products', 'category', slug],
    queryFn: async () => (await productsApi.list({ category: slug, limit: 24 })).data.data,
    enabled: Boolean(slug),
  })

  if (category.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!category.data) {
    return (
      <Container className="py-16 text-center">
        <h1 className="font-display text-2xl font-semibold">Category not found</h1>
        <Link to="/shop" className="mt-4 inline-block text-[var(--brand)]">
          Back to shop
        </Link>
      </Container>
    )
  }

  return (
    <Container className="py-10">
      <h1 className="font-display text-3xl font-semibold">{category.data.name}</h1>
      {category.data.description ? (
        <p className="mt-2 max-w-2xl text-[var(--fg-muted)]">{category.data.description}</p>
      ) : null}
      <div className="mt-8">
        <ProductGrid products={products.data} loading={products.isLoading} />
      </div>
    </Container>
  )
}
