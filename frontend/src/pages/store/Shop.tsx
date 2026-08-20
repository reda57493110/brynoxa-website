import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { brandsApi } from '@/api/brandsApi'
import { Container } from '@/components/ui/Container'
import { ProductGrid } from '@/components/product/ProductGrid'
import { FilterSidebar, type FilterValues } from '@/components/product/FilterSidebar'
import { SortSelect } from '@/components/product/SortSelect'
import { Pagination } from '@/components/ui/Pagination'
import { Drawer } from '@/components/ui/Drawer'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

export function Shop() {
  const t = useT()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const filters = useMemo(
    () => ({
      page: Number(params.get('page') || 1),
      limit: 12,
      sort: params.get('sort') || 'newest',
      q: params.get('q') || undefined,
      category: params.get('category') || undefined,
      brand: params.get('brand') || undefined,
      minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
      inStock: params.get('inStock') === 'true' ? true : undefined,
    }),
    [params]
  )

  const products = useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const res = await productsApi.list(filters)
      return { items: res.data.data, meta: res.data.meta }
    },
  })
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })
  const brands = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await brandsApi.list()).data.data,
  })

  const update = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) next.delete(k)
      else next.set(k, v)
    })
    if (!('page' in patch)) next.set('page', '1')
    setParams(next)
  }

  const filterValues: FilterValues = {
    category: filters.category,
    brand: filters.brand,
    minPrice: params.get('minPrice') || undefined,
    maxPrice: params.get('maxPrice') || undefined,
    inStock: filters.inStock,
  }

  const onFilterChange = (next: FilterValues) => {
    update({
      category: next.category,
      brand: next.brand,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
      inStock: next.inStock ? 'true' : undefined,
    })
  }

  const clearFilters = () => {
    const next = new URLSearchParams()
    if (filters.sort && filters.sort !== 'newest') next.set('sort', filters.sort)
    setParams(next)
  }

  const hasNarrowing = Boolean(
    filters.category ||
      filters.brand ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.q ||
      filters.inStock
  )

  const categoryList = (categories.data ?? []).filter(
    (c) => c.slug !== 'office' && c.slug !== 'networking'
  )
  const brandList = brands.data ?? []
  const activeCategory = categoryList.find((c) => c.slug === filters.category)
  const activeBrand = brandList.find((b) => b.slug === filters.brand)
  const total = products.data?.meta?.total ?? 0
  const pages = products.data?.meta?.pages || 1
  const from = total === 0 ? 0 : (filters.page - 1) * filters.limit + 1
  const to = Math.min(filters.page * filters.limit, total)
  const sidebarFilterCount = [
    filters.category,
    filters.brand,
    filters.minPrice,
    filters.maxPrice,
    filters.inStock,
  ].filter(Boolean).length

  useEffect(() => {
    const previous = document.title
    document.title = activeCategory
      ? `${activeCategory.name} — ${t('shop.title')} · Brynoxa`
      : filters.q
        ? `${t('shop.searchTitle')} “${filters.q}” — ${t('shop.title')} · Brynoxa`
        : `${t('shop.title')} — Brynoxa`
    return () => {
      document.title = previous
    }
  }, [activeCategory, filters.q, t])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [filters.page, filters.category, filters.brand, filters.q])

  const sidebar = (plain: boolean) => (
    <FilterSidebar
      categories={categoryList}
      brands={brandList}
      values={filterValues}
      onChange={(next) => {
        onFilterChange(next)
        if (plain) setFiltersOpen(false)
      }}
      onClear={() => {
        clearFilters()
        if (plain) setFiltersOpen(false)
      }}
      plain={plain}
    />
  )

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
      <section aria-labelledby="shop-heading" className="page-hero">
        <Container className="relative z-10 py-10 sm:py-12">
          <p className="kicker">{t('shop.kicker')}</p>
          <h1
            id="shop-heading"
            className="mt-3 max-w-3xl font-display text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-[3.25rem]"
          >
            {activeCategory?.name ?? (filters.q ? t('shop.searchTitle') : t('shop.title'))}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg">
            {filters.q ? (
              <>
                {t('shop.resultsFor', { q: filters.q })}
                {activeCategory ? t('shop.resultsIn', { name: activeCategory.name }) : null}
              </>
            ) : activeCategory?.description ? (
              activeCategory.description
            ) : (
              t('shop.body')
            )}
          </p>

          <ul className="mt-6 flex flex-wrap gap-2" aria-label={t('shop.filterNote')}>
            {(
              [
                { icon: 'banknote' as const, label: t('shop.heroProofCod') },
                { icon: 'tag' as const, label: t('shop.heroProofDh') },
                { icon: 'shield' as const, label: t('shop.heroProofWarranty') },
              ] as const
            ).map((item) => (
              <li
                key={item.label}
                className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg)]"
              >
                <SiteIcon name={item.icon} size={14} className="text-[var(--brand-text)]" />
                {item.label}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Container className="py-8 sm:py-10">
        <div
          className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
          aria-label={t('shop.shopByCategory')}
        >
          <button
            type="button"
            className={chip(!filters.category)}
            onClick={() => update({ category: undefined })}
          >
            {t('shop.all')}
          </button>
          {categoryList.map((c) => (
            <button
              key={c._id}
              type="button"
              className={chip(filters.category === c.slug)}
              onClick={() =>
                update({ category: filters.category === c.slug ? undefined : c.slug })
              }
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 shadow-soft">
          <p className="text-sm text-[var(--fg-muted)]">
            {products.isLoading ? (
              t('ui.loading')
            ) : (
              <>
                <span className="text-[var(--fg-muted)]">{t('shop.showing')} </span>
                <span className="font-medium text-[var(--fg)]">
                  {total === 0
                    ? t('shop.zeroProducts')
                    : t('shop.productsCount', { from, to, total })}
                </span>
                {sidebarFilterCount > 0 ? (
                  <span className="ms-2 text-xs text-[var(--brand-text)]">
                    · {t('shop.refined', { count: sidebarFilterCount })}
                  </span>
                ) : null}
              </>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition',
                filters.inStock
                  ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                  : 'border-[var(--border)] hover:border-[var(--brand)]'
              )}
              onClick={() => update({ inStock: filters.inStock ? undefined : 'true' })}
            >
              <SiteIcon name="package-check" size={14} />
              {t('shop.inStockOnly')}
            </button>
            <button
              type="button"
              className="relative inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm font-medium transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] lg:hidden"
              onClick={() => setFiltersOpen(true)}
            >
              <SiteIcon name="sliders" size={16} />
              {t('shop.filters')}
              {sidebarFilterCount > 0 ? (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand)] px-1 text-[11px] font-bold text-[var(--brand-fg)]">
                  {sidebarFilterCount}
                </span>
              ) : null}
            </button>
            <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} />
          </div>
        </div>

        {hasNarrowing ? (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {filters.q ? (
              <ActiveChip label={`“${filters.q}”`} onRemove={() => update({ q: undefined })} />
            ) : null}
            {activeCategory ? (
              <ActiveChip
                label={activeCategory.name}
                onRemove={() => update({ category: undefined })}
              />
            ) : null}
            {activeBrand ? (
              <ActiveChip label={activeBrand.name} onRemove={() => update({ brand: undefined })} />
            ) : null}
            {filters.inStock ? (
              <ActiveChip
                label={t('shop.inStockOnly')}
                onRemove={() => update({ inStock: undefined })}
              />
            ) : null}
            {filters.minPrice || filters.maxPrice ? (
              <ActiveChip
                label={`${filters.minPrice ?? 0}–${filters.maxPrice ?? '∞'} DH`}
                onRemove={() => update({ minPrice: undefined, maxPrice: undefined })}
              />
            ) : null}
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-medium text-[var(--brand-text)] hover:underline"
            >
              {t('ui.clearAll')}
            </button>
          </div>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <div className="sticky top-[calc(var(--nav-height)+0.75rem)] max-h-[calc(100svh-var(--nav-height)-1.5rem)] overflow-y-auto">
              {sidebar(false)}
            </div>
          </div>
          <div>
            {products.isError ? (
              <EmptyState
                title={t('shop.loadError')}
                description={t('shop.loadErrorBody')}
                actionLabel={t('common.retry')}
                onAction={() => products.refetch()}
              />
            ) : (
              <>
                <ProductGrid
                  products={products.data?.items}
                  loading={products.isLoading}
                  className="lg:grid-cols-2 xl:grid-cols-3"
                  emptyTitle={hasNarrowing ? t('shop.noMatch') : t('shop.empty')}
                  emptyDescription={
                    hasNarrowing ? t('shop.noMatchBody') : t('shop.emptyBody')
                  }
                  emptyActionLabel={hasNarrowing ? t('shop.clearFilters') : undefined}
                  onEmptyAction={hasNarrowing ? clearFilters : undefined}
                />
                <Pagination
                  page={filters.page}
                  pages={pages}
                  onChange={(page) => update({ page: String(page) })}
                />
              </>
            )}
          </div>
        </div>
      </Container>

      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('shop.filters')}
        side="left"
      >
        {sidebar(true)}
      </Drawer>
    </>
  )
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const t = useT()
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] pl-3 pr-1 text-xs font-medium text-[var(--fg)]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
        aria-label={t('ui.removeNamed', { label })}
      >
        <SiteIcon name="close" size={12} />
      </button>
    </span>
  )
}
