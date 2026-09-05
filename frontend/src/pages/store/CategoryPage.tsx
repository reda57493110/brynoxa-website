import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { categoriesApi } from '@/api/categoriesApi'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { SortSelect } from '@/components/product/SortSelect'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHero } from '@/components/layout/PageHero'
import { Skeleton } from '@/components/ui/Skeleton'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayDescription, categoryDisplayName } from '@/i18n'
import { cn } from '@/lib/cn'

export function CategoryPage() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const sort = params.get('sort') || 'newest'

  const category = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => (await categoriesApi.getBySlug(slug)).data.data,
    enabled: Boolean(slug),
  })
  const products = useQuery({
    queryKey: ['products', 'category', slug, sort],
    queryFn: async () =>
      (await productsApi.list({ category: slug, limit: 24, sort })).data.data,
    enabled: Boolean(slug),
    placeholderData: keepPreviousData,
  })
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  const displayName = category.data
    ? categoryDisplayName(locale, category.data.slug, category.data.name)
    : ''
  const displayDescription = category.data
    ? categoryDisplayDescription(
        locale,
        category.data.slug,
        category.data.description
      ) || t('shop.categoryFallback')
    : ''

  usePageTitle(
    category.data
      ? `${displayName} — ${t('shop.title')} · Brynoxa`
      : `${t('shop.title')} — Brynoxa`
  )

  if (category.isError) {
    return (
      <Container className="py-8 sm:py-10">
        <QueryErrorState
          title={t('shop.loadError')}
          description={t('shop.loadErrorBody')}
          onRetry={() => category.refetch()}
        />
      </Container>
    )
  }

  if (!category.isPending && !category.data) {
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
  const productsLoading = category.isPending || products.isPending || products.isFetching

  return (
    <>
      <PageHero
        kicker={t('shop.categoryKicker')}
        title={
          category.data ? (
            displayName
          ) : (
            <Skeleton className="inline-block h-9 w-48 align-middle sm:h-11 sm:w-64" />
          )
        }
        description={
          category.data ? (
            displayDescription
          ) : (
            <Skeleton className="mt-1 h-4 w-72 max-w-full" />
          )
        }
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
                {categoryDisplayName(locale, c.slug, c.name)}
              </Link>
            ))}
        </div>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--fg-muted)]">
            {productsLoading
              ? t('ui.loadingProducts')
              : productCount === 1
                ? t('shop.productCountOne', { count: productCount })
                : t('shop.productCount', { count: productCount })}
          </p>
          <SortSelect
            value={sort}
            onChange={(next) => {
              const updated = new URLSearchParams(params)
              if (!next || next === 'newest') updated.delete('sort')
              else updated.set('sort', next)
              setParams(updated)
            }}
          />
        </div>
        {products.isError && !productsLoading ? (
          <QueryErrorState
            title={t('shop.loadError')}
            description={t('shop.loadErrorBody')}
            onRetry={() => products.refetch()}
          />
        ) : (
          <ProductGrid
            products={products.data}
            loading={productsLoading}
            emptyTitle={t('shop.categoryEmpty')}
            emptyDescription={t('shop.categoryEmptyBody')}
            emptyActionLabel={t('common.allProducts')}
            emptyActionTo="/shop"
          />
        )}
      </Container>
    </>
  )
}
