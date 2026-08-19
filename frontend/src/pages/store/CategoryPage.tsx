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
import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'

export function CategoryPage() {
  const t = useT()
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

  usePageTitle(category.data ? `${category.data.name} — ${t('shop.title')} · Brynoxa` : `${t('shop.title')} — Brynoxa`)

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
      <Container className="py-8 sm:py-10">
        <EmptyState
          title={t('shop.categoryMissing')}
          description={t('shop.categoryMissingBody')}
          actionLabel={t('shop.backToShop')}
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

  const productCount = products.data?.length ?? 0

  return (
    <>
      <PageHero
        kicker={t('shop.categoryKicker')}
        title={category.data.name}
        description={category.data.description || t('shop.categoryFallback')}
      />
      <Container className="py-8 sm:py-10">
        <div
          className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          aria-label={t('shop.shopByCategory')}
        >
          <Link to="/shop" className={chip(false)}>
            {t('shop.all')}
          </Link>
          {(categories.data ?? [])
            .filter((c) => c.slug !== 'office' && c.slug !== 'networking')
            .map((c) => (
            <Link key={c._id} to={`/category/${c.slug}`} className={chip(c.slug === slug)}>
              {c.name}
            </Link>
          ))}
        </div>
        <p className="mb-5 text-sm text-[var(--fg-muted)]">
          {products.isLoading
            ? t('ui.loading')
            : productCount === 1
              ? t('shop.productCountOne', { count: productCount })
              : t('shop.productCount', { count: productCount })}
        </p>
        <ProductGrid
          products={products.data}
          loading={products.isLoading}
          emptyTitle={t('shop.categoryEmpty')}
          emptyDescription={t('shop.categoryEmptyBody')}
          emptyActionLabel={t('common.allProducts')}
          emptyActionTo="/shop"
        />
      </Container>
    </>
  )
}
