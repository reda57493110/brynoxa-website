import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { brandsApi } from '@/api/brandsApi'
import { Container } from '@/components/ui/Container'
import { Skeleton } from '@/components/ui/Skeleton'
import { SortSelect } from '@/components/product/SortSelect'
import { Pagination } from '@/components/ui/Pagination'
import { Drawer } from '@/components/ui/Drawer'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { HomeShopCard } from '@/components/home/HomeShopCard'
import { ShopBanner } from '@/components/shop/ShopBanner'
import { ShopCategoryStrip } from '@/components/shop/ShopCategoryStrip'
import { ShopFilters, type ShopFilterValues } from '@/components/shop/ShopFilters'
import { ShopListCard } from '@/components/shop/ShopListCard'
import { cn } from '@/lib/cn'
import { childrenOf, mainCategories, mainOf, withSubCategories } from '@/lib/categoryTree'
import { categoryPhoto } from '@/lib/categoryPhoto'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { trackSearch } from '@/lib/analytics'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayDescription, categoryDisplayName } from '@/i18n'
import { brandName } from '@/lib/brand'
import { BUDGETS } from '@/lib/homeRows'
import { SIGNATURE_BRAND } from '@/hooks/useHomeRows'


type View = 'grid' | 'list'
const VIEW_KEY = 'brynoxa-shop-view'
/** Products per page the visitor can choose (12 by default, as preload.js asks) */
export const PAGE_SIZES = [12, 24, 48] as const

/**
 * The shop, in the style of the big Moroccan PC shops (Brynoxa colours): path, dark banner (title,
 * description, search, the header product), category cards, then the filters on the left and the
 * products on the right — as a grid of cards or as long rows with the specs (remembered on this
 * device). Every choice lives in the address (?category=…&brand=…&minPrice=…&sort=…).
 */
export function Shop({ categorySlug }: { categorySlug?: string } = {}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
    } catch {
      return 'grid'
    }
  })
  const chooseView = (v: View) => {
    setView(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* private mode: this visit only */
    }
  }

  const filters = useMemo(
    () => ({
      page: Number(params.get('page') || 1),
      limit: PAGE_SIZES.find((n) => String(n) === params.get('limit')) ?? 12,
      // Default: one product of each kind in turn, so the first rows show the whole shop
      sort: params.get('sort') || 'mixed',
      q: params.get('q') || undefined,
      // A category page (/category/x) keeps its category; the shop reads ?category=
      category: categorySlug || params.get('category') || undefined,
      brand: params.get('brand') || undefined,
      minPrice: params.get('minPrice') ? Number(params.get('minPrice')) : undefined,
      maxPrice: params.get('maxPrice') ? Number(params.get('maxPrice')) : undefined,
      inStock: params.get('inStock') === 'true' ? true : undefined,
      onSale: params.get('onSale') === 'true' ? true : undefined,
    }),
    [params, categorySlug]
  )

  const products = useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const res = await productsApi.list(filters)
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })
  // Skeleton on first load or a filter change — not on silent background refetches
  const productsLoading = products.isPending || products.isPlaceholderData
  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })
  // The same list plus the empty sub-categories ("Coming soon" cards); the shop works without it
  const withSoon = useQuery({
    queryKey: ['categories', 'with-empty-subs'],
    queryFn: async () => (await categoriesApi.listWithEmptySubs()).data.data,
    staleTime: 5 * 60_000,
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
    // On a category page, another category opens its own page (or the shop for "All")
    if (categorySlug && 'category' in patch && patch.category !== categorySlug) {
      next.delete('category')
      next.delete('page')
      const query = next.toString()
      navigate(`${patch.category ? `/category/${patch.category}` : '/shop'}${query ? `?${query}` : ''}`, { state: { keepScroll: true } })
      return
    }
    if (categorySlug) next.delete('category')
    // Category / filter changes keep the page where it is; changing page goes back up
    setParams(next, 'page' in patch ? undefined : { state: { keepScroll: true } })
  }

  const filterValues: ShopFilterValues = {
    category: filters.category,
    brand: filters.brand,
    minPrice: params.get('minPrice') || undefined,
    maxPrice: params.get('maxPrice') || undefined,
    inStock: filters.inStock,
    onSale: filters.onSale,
  }
  const onFilterChange = (next: ShopFilterValues) =>
    update({
      category: next.category,
      brand: next.brand,
      minPrice: next.minPrice,
      maxPrice: next.maxPrice,
      inStock: next.inStock ? 'true' : undefined,
      onSale: next.onSale ? 'true' : undefined,
    })

  // Reset: everything but the order (and, on a category page, the category itself)
  const clearFilters = () => {
    const next = new URLSearchParams()
    if (filters.sort && filters.sort !== 'mixed') next.set('sort', filters.sort)
    setParams(next)
  }

  const hasNarrowing = Boolean((filters.category && !categorySlug) || filters.brand || filters.minPrice || filters.maxPrice || filters.q || filters.inStock || filters.onSale)

  const categoryList = (categories.data ?? []).filter((c) => c.slug !== 'office' && c.slug !== 'networking')
  const brandList = brands.data ?? []
  const activeCategory = categoryList.find((c) => c.slug === filters.category)
  // Two levels: the main categories, then the sub-categories of the chosen one
  const mainList = mainCategories(categoryList)
  const activeMain = mainOf(categoryList, activeCategory)
  const subList = activeMain ? childrenOf(categoryList, activeMain._id) : []
  // Sub-categories still empty: shown as "Coming soon" (not clickable) after the real ones
  const soonList = (withSoon.data ?? []).filter((c) => c.empty)
  const soonOf = (mainId: string) => childrenOf([...categoryList, ...soonList], mainId).filter((c) => c.empty)
  const activeCategoryName = activeCategory ? categoryDisplayName(locale, activeCategory.slug, activeCategory.name) : undefined
  const activeCategoryDescription = activeCategory ? categoryDisplayDescription(locale, activeCategory.slug, activeCategory.description) : undefined

  const shopTitle = activeCategoryName
    ? `${activeCategoryName} — ${t('shop.title')} · ${brandName()}`
    : filters.q
      ? `${t('shop.searchTitle')} “${filters.q}” — ${t('shop.title')} · ${brandName()}`
      : t('meta.shopTitle')

  // Category page: "{category} in Morocco — best prices in DH"; the admin's own description first
  const categoryMeta = categorySlug && activeCategoryName
    ? {
        title: t('meta.categoryTitle', { name: activeCategoryName }),
        description: activeCategoryDescription
          ? `${activeCategoryDescription.trim().replace(/\.?$/, '.')} ${t('meta.categoryDescription', { name: activeCategoryName })}`.slice(0, 300)
          : t('meta.categoryDescription', { name: activeCategoryName }),
        image: activeCategory ? categoryPhoto(activeCategory, categoryList) : undefined,
      }
    : null

  useSeo({
    title: categoryMeta?.title ?? shopTitle,
    description: categoryMeta?.description ?? (activeCategoryDescription || (filters.q ? `${t('shop.searchTitle')} “${filters.q}” — ${t('meta.shopDescription')}` : t('meta.shopDescription'))),
    image: categoryMeta?.image,
    // /shop?category=x is the same list as /category/x: tell Google which address to keep
    path: filters.category ? `/category/${filters.category}` : '/shop',
    // Search result pages are endless and thin: kept out of Google
    noIndex: Boolean(filters.q),
  })

  useEffect(() => {
    if (filters.q) trackSearch(filters.q)
  }, [filters.q])

  const activeBrand = brandList.find((b) => b.slug === filters.brand)
  const total = products.data?.meta?.total ?? 0
  const pages = products.data?.meta?.pages || 1
  const from = total === 0 ? 0 : (filters.page - 1) * filters.limit + 1
  const to = Math.min(filters.page * filters.limit, total)
  const sidebarFilterCount = [categorySlug ? undefined : filters.category, filters.brand, filters.minPrice || filters.maxPrice, filters.inStock, filters.onSale].filter(Boolean).length

  // Path: Home › Shop › Components › RAM (or › Search "…")
  const crumbs: { label: string; to?: string }[] = [{ label: t('common.home'), to: '/' }]
  if (activeCategory || filters.q) crumbs.push({ label: t('shop.title'), to: '/shop' })
  else crumbs.push({ label: t('shop.title') })
  if (activeMain && activeCategory && activeMain._id !== activeCategory._id) {
    crumbs.push({ label: categoryDisplayName(locale, activeMain.slug, activeMain.name), to: `/category/${activeMain.slug}` })
  }
  if (activeCategoryName) crumbs.push({ label: activeCategoryName })
  if (filters.q) crumbs.push({ label: `“${filters.q}”` })

  const bannerTitle = filters.q ? `${t('shop.searchTitle')} “${filters.q}”` : (activeCategoryName ?? `${t('shop.heroTitleLead')} ${t('shop.heroTitleAccent')}`)
  // Round photos under the search bar: sub-categories inside a category that has some, else the main ones
  const stripInside = Boolean(activeMain && (subList.length || soonOf(activeMain._id).length))
  // "All": every main category followed by its sub-categories (Accessories, Mice, Headphones…)
  const stripItems = stripInside ? [...subList, ...soonOf(activeMain!._id)] : withSubCategories(mainList, categoryList)
  const stripActive = stripInside ? (filters.category === activeMain!.slug ? undefined : filters.category) : filters.category

  // Quick choices above the products (each a toggle): deals, in stock, the budget bands, Brynoxa
  const quick: { id: string; label: string; on: boolean; toggle: () => void }[] = [
    { id: 'sale', label: t('shop.onSaleOnly'), on: Boolean(filters.onSale), toggle: () => update({ onSale: filters.onSale ? undefined : 'true' }) },
    { id: 'stock', label: t('shop.inStockOnly'), on: Boolean(filters.inStock), toggle: () => update({ inStock: filters.inStock ? undefined : 'true' }) },
    ...BUDGETS.map((b) => {
      const on = String(filters.minPrice ?? '') === String(b.min ?? '') && String(filters.maxPrice ?? '') === String(b.max ?? '')
      return {
        id: b.id,
        label: t(b.label, { min: (b.min ?? 0).toLocaleString('fr-MA'), max: (b.max ?? 0).toLocaleString('fr-MA') }),
        on,
        toggle: () => update({ minPrice: on || !b.min ? undefined : String(b.min), maxPrice: on || !b.max ? undefined : String(b.max) }),
      }
    }),
    ...(brandList.some((b) => b.slug === SIGNATURE_BRAND)
      ? [{ id: 'brynoxa', label: brandName(), on: filters.brand === SIGNATURE_BRAND, toggle: () => update({ brand: filters.brand === SIGNATURE_BRAND ? undefined : SIGNATURE_BRAND }) }]
      : []),
  ]

  const filtersPanel = (
    <ShopFilters categories={categoryList} soon={soonList} brands={brandList} values={filterValues} onChange={onFilterChange} onClear={clearFilters} activeCount={sidebarFilterCount} />
  )

  return (
    <>
      <Container className="max-w-[96rem]">
        <ShopBanner
          crumbs={crumbs}
          title={bannerTitle}
          search={filters.q ?? ''}
          onSearch={(q) => update({ q: q || undefined })}
        />

        <ShopCategoryStrip
          items={stripItems}
          all={categoryList}
          activeSlug={stripActive}
          label={stripInside ? categoryDisplayName(locale, activeMain!.slug, activeMain!.name) : t('shop.shopByCategory')}
          onPick={(slug) => update({ category: slug ?? (stripInside ? activeMain!.slug : undefined) })}
        />
      </Container>

      <Container className="max-w-[96rem] pb-8 pt-4 sm:pb-12 sm:pt-6">
        <div className="grid gap-5 lg:grid-cols-[16.5rem_minmax(0,1fr)] xl:gap-6">
          {/* Computers: the filters, always in view */}
          <aside aria-label={t('shop.filters')} className="hidden lg:block">
            <div className="sticky top-[calc(var(--nav-height)+0.75rem)] max-h-[calc(100svh-var(--nav-height)-1.5rem)] overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 [scrollbar-width:thin]">
              {filtersPanel}
            </div>
          </aside>

          <div className="min-w-0">
            {/* Toolbar: how many, Filters (phones), sort, grid / list */}
            {/* Phones / tablets: stays under the menu bar while scrolling (Filters and Sort at hand) */}
            <div className="sticky top-[calc(var(--nav-height)+0.25rem)] z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]/95 p-2 shadow-soft backdrop-blur sm:mb-4 sm:gap-3 sm:p-2.5 lg:static lg:bg-[var(--bg-elevated)] lg:shadow-none lg:backdrop-blur-none">
              <p className="min-w-0 flex-1 basis-full px-1 text-xs text-[var(--fg-muted)] sm:basis-auto sm:text-sm">
                {productsLoading ? (
                  t('ui.loadingProducts')
                ) : total === 0 ? (
                  <span className="font-semibold text-[var(--fg)]">{t('shop.zeroProducts')}</span>
                ) : (
                  <>
                    <span className="font-display text-base font-extrabold text-[var(--fg)]">{total}</span> <span className="font-semibold text-[var(--fg)]">{t('shop.productsWord')}</span>
                    {total > to - from + 1 ? <span> · {t('shop.productsCount', { from, to, total })}</span> : null}
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setFiltersOpen(true)}
                className="relative inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-xs font-bold uppercase transition hover:border-[var(--brand)] sm:flex-none sm:text-sm lg:hidden"
              >
                <SiteIcon name="sliders" size={16} />
                {t('shop.filters')}
                {sidebarFilterCount ? <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[11px] text-[var(--brand-fg)]">{sidebarFilterCount}</span> : null}
              </button>
              <SortSelect value={filters.sort} onChange={(sort) => update({ sort })} className="h-10 flex-1 rounded-xl sm:flex-none" />
              <label className="hidden h-10 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] ps-3 pe-1 text-sm sm:inline-flex">
                <span className="text-[var(--fg-muted)]">{t('shop.perPage')}</span>
                <select
                  value={filters.limit}
                  onChange={(e) => update({ limit: e.target.value === '12' ? undefined : e.target.value })}
                  className="h-8 rounded-lg bg-transparent px-1 font-semibold text-[var(--fg)] outline-none"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <div role="group" aria-label={t('shop.viewLabel')} className="flex h-10 items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-0.5">
                {(['grid', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => chooseView(v)}
                    aria-pressed={view === v}
                    aria-label={v === 'grid' ? t('shop.viewGrid') : t('shop.viewList')}
                    title={v === 'grid' ? t('shop.viewGrid') : t('shop.viewList')}
                    className={cn('grid size-8 place-items-center rounded-lg transition', view === v ? 'bg-[var(--brand)] text-[var(--brand-fg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]')}
                  >
                    <SiteIcon name={v === 'grid' ? 'view-two' : 'view-one'} size={15} />
                  </button>
                ))}
              </div>
            </div>

            {/* Quick choices */}
            <div role="group" aria-label={t('shop.quickFilters')} className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
              {quick.map((q) => (
                <button
                  key={q.id}
                  type="button"
                  aria-pressed={q.on}
                  onClick={q.toggle}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-bold transition',
                    q.on
                      ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow'
                      : 'border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
                  )}
                >
                  {q.on ? <SiteIcon name="check" size={12} /> : null}
                  {q.label}
                </button>
              ))}
            </div>

            {/* What is chosen, each removable */}
            {hasNarrowing ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
                {filters.q ? <ActiveChip label={`“${filters.q}”`} onRemove={() => update({ q: undefined })} /> : null}
                {activeCategory && !categorySlug ? <ActiveChip label={activeCategoryName!} onRemove={() => update({ category: undefined })} /> : null}
                {activeBrand ? <ActiveChip label={activeBrand.name} onRemove={() => update({ brand: undefined })} /> : null}
                {filters.onSale ? <ActiveChip label={t('shop.onSaleOnly')} onRemove={() => update({ onSale: undefined })} /> : null}
                {filters.inStock ? <ActiveChip label={t('shop.inStockOnly')} onRemove={() => update({ inStock: undefined })} /> : null}
                {filters.minPrice || filters.maxPrice ? (
                  <ActiveChip label={`${filters.minPrice ?? 0}–${filters.maxPrice ?? '∞'} DH`} onRemove={() => update({ minPrice: undefined, maxPrice: undefined })} />
                ) : null}
                <button type="button" onClick={clearFilters} className="text-xs font-bold text-[var(--brand-text)] hover:underline">
                  {t('ui.clearAll')}
                </button>
              </div>
            ) : null}

            {products.isError ? (
              <EmptyState title={t('shop.loadError')} description={t('shop.loadErrorBody')} actionLabel={t('common.retry')} onAction={() => products.refetch()} />
            ) : (
              <>
                {/* Not sure what to pick? Setups show what goes together (gaming, study, work…) */}
                {!filters.q && filters.page === 1 ? (
                  <Link
                    to="/setups"
                    className="group mb-3 flex items-center justify-between gap-3 rounded-xl border border-dashed border-[rgb(0_194_255/0.45)] bg-[rgb(0_194_255/0.06)] px-3 py-2.5 text-[13px] transition hover:border-[var(--brand)] sm:mb-4 sm:px-4 sm:text-sm"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <SiteIcon name="monitor" size={16} className="shrink-0 text-[var(--brand-text)]" />
                      <span className="truncate text-[var(--fg-muted)]">{t('setups.hintQuestion')}</span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 font-bold text-[var(--brand-text)]">
                      {t('setups.hintLink')}
                      <SiteIcon name="arrow-right" size={14} className="transition group-hover:translate-x-0.5 rtl:rotate-180" />
                    </span>
                  </Link>
                ) : null}

                {productsLoading ? (
                  <ul className={view === 'grid' ? 'grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4' : 'space-y-3'} role="status" aria-busy="true">
                    {Array.from({ length: view === 'grid' ? 8 : 4 }).map((_, i) => (
                      <li key={i}>
                        <Skeleton spinner className={view === 'grid' ? 'aspect-[3/4.4] rounded-2xl' : 'h-56 rounded-2xl'} />
                      </li>
                    ))}
                    <span className="sr-only">{t('ui.loadingProducts')}</span>
                  </ul>
                ) : !products.data?.items.length ? (
                  hasNarrowing ? (
                    <EmptyState title={t('shop.noMatch')} description={t('shop.noMatchBody')} actionLabel={t('shop.clearFilters')} onAction={clearFilters} />
                  ) : activeCategory ? (
                    // A main category shown before it has products (Desktop PCs…): say so, offer the shop
                    <EmptyState title={t('shop.categoryEmpty')} description={t('shop.categoryEmptyBody')} actionLabel={t('shop.backToShop')} onAction={() => navigate('/shop')} />
                  ) : (
                    <EmptyState title={t('shop.empty')} description={t('shop.emptyBody')} />
                  )
                ) : view === 'grid' ? (
                  <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
                    {products.data.items.map((p, i) => (
                      // Rise in with CSS: visible at once, never waiting for the animation code
                      <li key={p._id} data-rise="card" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                        <HomeShopCard product={p} eager={i < 4} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-3">
                    {products.data.items.map((p, i) => (
                      <li key={p._id} data-rise="card" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                        <ShopListCard product={p} eager={i < 2} />
                      </li>
                    ))}
                  </ul>
                )}
                <Pagination page={filters.page} pages={pages} onChange={(page) => update({ page: String(page) })} />
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
        footer={
          <Button className="h-12 w-full rounded-full text-base" onClick={() => setFiltersOpen(false)}>
            {productsLoading ? t('ui.loadingProducts') : t('shop.showResults', { count: total })}
          </Button>
        }
      >
        {filtersPanel}
      </Drawer>
    </>
  )
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const t = useT()
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-[rgb(0_194_255/0.4)] bg-[rgb(0_194_255/0.08)] ps-3 pe-1 text-xs font-semibold text-[var(--fg)]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex size-6 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
        aria-label={t('ui.removeNamed', { label })}
      >
        <SiteIcon name="close" size={12} />
      </button>
    </span>
  )
}
