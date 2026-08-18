import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/api/categoriesApi'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { Spinner } from '@/components/ui/Spinner'
import { usePageTitle } from '@/hooks/usePageTitle'
import { cn } from '@/lib/cn'

export function CategoryPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
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
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  usePageTitle(category.data ? `${category.data.name} — Shop · Brynoxa` : 'Shop — Brynoxa')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  if (category.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!category.data) {
    return (
      <Container className="py-16">
        <EmptyState
          title="Category not found"
          description="That category is not in the shop."
          actionLabel="Back to shop"
          onAction={() => navigate('/shop')}
        />
      </Container>
    )
  }

  const chip = (active: boolean) =>
    cn(
      'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
      active
        ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
        : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
    )

  return (
    <>
      <PageHero
        kicker="Category"
        title={category.data.name}
        description={
          category.data.description ||
          'Prices in DH. Cash on delivery across Morocco.'
        }
      />
      <Container className="py-8 sm:py-10">
        <div
          className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          aria-label="Shop by category"
        >
          <Link to="/shop" className={chip(false)}>
            All
          </Link>
          {(categories.data ?? []).map((c) => (
            <Link key={c._id} to={`/category/${c.slug}`} className={chip(c.slug === slug)}>
              {c.name}
            </Link>
          ))}
        </div>
        <p className="mb-5 text-sm text-[var(--fg-muted)]">
          {products.isLoading
            ? 'Loading catalog…'
            : `${products.data?.length ?? 0} product${(products.data?.length ?? 0) === 1 ? '' : 's'}`}
        </p>
        <ProductGrid
          products={products.data}
          loading={products.isLoading}
          emptyTitle="Nothing in this category yet"
          emptyDescription="Try another category or browse the full shop."
          emptyActionLabel="All products"
          emptyActionTo="/shop"
        />
      </Container>
    </>
  )
}
