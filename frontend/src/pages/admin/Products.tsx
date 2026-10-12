import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SafeImage } from '@/components/ui/SafeImage'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { ActiveToggle } from '@/components/admin/ActiveToggle'
import { ProductPlacementDialog } from '@/components/admin/ProductPlacementDialog'
import { MAX_HOME_DEALS } from '@/hooks/useHomeDeals'
import { useStorefrontPlacements, type Placement } from '@/hooks/useStorefrontPlacements'
import { optimizedImageUrl } from '@/lib/image'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { Category, Product, ProductCondition } from '@/types'

type PlacementFilter = '' | 'home' | 'deals' | 'featured' | 'carousel' | 'none'

const control = 'h-9 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--fg)] outline-none ring-brand'

const SHORT: Record<string, string> = {
  deals: 'Top deals',
  spotlight: 'Featured card',
  row: 'Featured row',
  shopHeader: 'Shop header',
  featuredWaiting: 'Featured · waiting',
  carouselWaiting: 'Row · waiting',
}

function badgeFor(pl: Placement): { text: string; variant: BadgeVariant; title: string } {
  const text = `${SHORT[pl.key] ?? pl.label}${pl.detail && !pl.waiting ? ` ${pl.detail}` : ''}`
  return {
    text,
    variant: pl.waiting ? 'warning' : 'brand',
    title: `${pl.label}${pl.detail ? ` — ${pl.detail}` : ''}${pl.auto ? ' (automatic)' : ''}`,
  }
}

/** Home / shop placements as small badges (category is shown in its own column). */
function PlacementBadges({ placements, onMore, max = 2 }: { placements: Placement[]; onMore: () => void; max?: number }) {
  const list = placements.filter((p) => p.key !== 'category' && p.key !== 'hidden')
  if (placements.some((p) => p.key === 'hidden')) return <span className="text-xs text-[var(--fg-muted)]">Not on storefront</span>
  if (!list.length) return <span className="text-xs text-[var(--fg-muted)]">Shop &amp; category only</span>
  const shown = list.slice(0, max)
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((pl) => {
        const b = badgeFor(pl)
        return (
          <span key={pl.key} title={b.title}>
            <Badge variant={b.variant} className="normal-case">
              {b.text}
            </Badge>
          </span>
        )
      })}
      {list.length > max ? (
        <button type="button" onClick={onMore} className="text-[11px] font-medium text-[var(--brand-text)] hover:underline">
          +{list.length - max}
        </button>
      ) : null}
    </span>
  )
}

/** Storefront sections, in the order customers see them (same order as the server's 'placement' sort). */
type Group = 'deals' | 'spotlight' | 'row' | 'shopHeader' | 'shop' | 'hidden'

const GROUPS: Record<Group, { n: number; title: string; hint: string; icon: SiteIconName }> = {
  deals: { n: 1, title: 'Home · Top deals (hero)', hint: 'Very top of the home page', icon: 'tag' },
  spotlight: { n: 2, title: 'Home · Featured card', hint: 'Big card of the “Featured” section', icon: 'star' },
  row: { n: 3, title: 'Home · Featured row (carousel)', hint: 'Product row under the Featured card', icon: 'layers' },
  shopHeader: { n: 4, title: 'Shop · Header', hint: 'Top of the Shop page', icon: 'monitor' },
  shop: { n: 5, title: 'Shop · Other products', hint: 'Listed in the Shop and their category', icon: 'cart' },
  hidden: { n: 6, title: 'Hidden', hint: 'Not on the storefront', icon: 'close' },
}

/** First section the product appears in (it is listed once, under that section). */
function groupOf(placements: Placement[]): Group {
  const shown = (key: string) => placements.some((p) => p.key === key && !p.waiting)
  if (placements.some((p) => p.key === 'hidden')) return 'hidden'
  if (shown('deals')) return 'deals'
  if (shown('spotlight')) return 'spotlight'
  if (shown('row')) return 'row'
  if (shown('shopHeader')) return 'shopHeader'
  return 'shop'
}

function SectionHeading({ group, count, note }: { group: Group; count?: number; note?: string }) {
  const g = GROUPS[group]
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-[var(--brand-fg)]">
        {g.n}
      </span>
      <SiteIcon name={g.icon} size={13} className="shrink-0 text-[var(--brand-text)]" />
      <span className="min-w-0 truncate text-xs font-semibold text-[var(--fg)]">{g.title}</span>
      {count !== undefined ? (
        <span className="rounded-full bg-[var(--bg-elevated)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)]">{count}</span>
      ) : null}
      {note ? (
        <>
          <span className="shrink-0 text-[11px] text-[var(--fg-muted)] sm:hidden">↑ above</span>
          <span className="truncate text-[11px] text-[var(--fg-muted)] max-sm:hidden">→ {note}</span>
        </>
      ) : (
        <span className="hidden truncate text-[11px] text-[var(--fg-muted)] sm:inline">· {g.hint}</span>
      )}
    </span>
  )
}

const GROUP_ORDER: Group[] = ['deals', 'spotlight', 'row', 'shopHeader', 'shop', 'hidden']

export function Products() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all')
  const [condition, setCondition] = useState<ProductCondition | ''>('')
  const [placement, setPlacement] = useState<PlacementFilter>('')
  // Default: the storefront's own order (home page top to bottom, shop header, the rest)
  const [sort, setSort] = useState<'placement' | 'newest' | 'name' | 'price_asc' | 'price_desc'>('placement')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [placing, setPlacing] = useState<Product | null>(null)
  const place = useStorefrontPlacements()

  const cats = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data,
  })

  const filters = useMemo(
    () => ({
      page,
      limit: 15,
      q: q || undefined,
      category: category || undefined,
      isActive: active === 'all' ? undefined : active === 'true',
      condition: condition || undefined,
      featured: placement === 'featured' ? true : undefined,
      carousel: placement === 'carousel' ? true : undefined,
      placement: placement === 'home' || placement === 'deals' || placement === 'none' ? placement : undefined,
      sort,
      admin: true,
    }),
    [page, q, category, active, condition, placement, sort]
  )

  const products = useQuery({
    queryKey: ['admin-products', filters],
    queryFn: async () => {
      const res = await adminApi.products.list(filters)
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.products.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Product deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const items = products.data?.items ?? []
  // Keep the open placement panel in sync with fresh data after each change
  const placingLive = placing ? (items.find((p) => p._id === placing._id) ?? placing) : null
  const pages = products.data?.meta?.pages || 1
  const total = products.data?.meta?.total ?? 0
  const filtered = Boolean(q || category || active !== 'all' || condition || placement)
  const setFilter = (fn: () => void) => {
    fn()
    setPage(1)
  }

  const groups = items.map((p) => groupOf(place.placementsOf(p)))
  // Products per home / shop section (the whole storefront, not just this page)
  const groupCount: Partial<Record<Group, number>> = {
    deals: place.deals.products.length,
    spotlight: place.featuredList[0] ? 1 : 0,
    row: place.row.length,
    shopHeader: place.shopHero.product ? 1 : 0,
  }
  // A section whose product is already listed in an earlier one (e.g. top deal #1 is also the
  // Featured card) still gets its heading, pointing to that product
  const alsoAbove: Partial<Record<Group, string | undefined>> = {
    spotlight: place.featuredList[0]?.name,
    shopHeader: place.shopHero.product?.name,
  }
  const groupHeading = (i: number) => {
    if (sort !== 'placement' || !place.ready || (i > 0 && groups[i] === groups[i - 1])) return null
    const from = i === 0 && page === 1 ? 0 : i === 0 ? GROUP_ORDER.indexOf(groups[0]) : GROUP_ORDER.indexOf(groups[i - 1]) + 1
    const to = GROUP_ORDER.indexOf(groups[i])
    const skipped = GROUP_ORDER.slice(from, to).filter((g) => alsoAbove[g] && groupCount[g])
    return (
      <span className="flex flex-col gap-1">
        {skipped.map((g) => (
          <SectionHeading key={g} group={g} count={groupCount[g]} note={`${alsoAbove[g]} (listed above)`} />
        ))}
        <SectionHeading group={groups[i]} count={groupCount[groups[i]]} />
      </span>
    )
  }

  const imgOf = (p: Product) => p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
  const catOf = (p: Product) => (typeof p.category === 'object' && p.category ? p.category : null)

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">Products</h1>
        <Link to="/admin/products/new">
          <Button size="sm">
            <SiteIcon name="plus" size={15} /> Add product
          </Button>
        </Link>
      </div>

      {/* What the storefront shows right now */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-xs">
        <span className="font-semibold text-[var(--fg-muted)]">Storefront</span>
        <button type="button" onClick={() => setFilter(() => setPlacement('deals'))} className="hover:text-[var(--brand-text)]">
          Top deals{' '}
          <span className="font-semibold tabular-nums">
            {place.deals.products.length}/{MAX_HOME_DEALS}
          </span>
          {place.pinnedDeals.length ? null : <span className="text-[var(--fg-muted)]"> (automatic)</span>}
        </button>
        <span className="max-w-[16rem] truncate" title={place.featuredList[0]?.name}>
          Featured card: <span className="font-semibold">{place.featuredList[0]?.name ?? '—'}</span>
        </span>
        <button type="button" onClick={() => setFilter(() => setPlacement(place.rowFromCarousel ? 'carousel' : 'featured'))} className="hover:text-[var(--brand-text)]">
          Featured row <span className="font-semibold tabular-nums">{place.row.length}</span>
        </button>
        <span className="max-w-[16rem] truncate" title={place.shopHero.product?.name}>
          Shop header: <span className="font-semibold">{place.shopHero.product?.name ?? '—'}</span>
          {place.shopHeroSetting ? null : <span className="text-[var(--fg-muted)]"> (auto)</span>}
        </span>
        <Link to="/admin/settings" className="ms-auto text-[var(--brand-text)] hover:underline">
          Order deals →
        </Link>
      </div>

      {/* Toolbar */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 basis-full sm:flex-[1_1_14rem] sm:basis-auto">
          <SiteIcon name="search" size={15} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="search"
            aria-label="Search products"
            placeholder="Name or SKU"
            value={q}
            onChange={(e) => setFilter(() => setQ(e.target.value))}
            className={cn(control, 'w-full ps-8')}
          />
        </div>
        <select aria-label="Category" value={category} onChange={(e) => setFilter(() => setCategory(e.target.value))} className={cn(control, 'flex-[1_1_8rem] sm:flex-none')}>
          <option value="">All categories</option>
          {(cats.data as Category[] | undefined)?.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={active} onChange={(e) => setFilter(() => setActive(e.target.value as typeof active))} className={cn(control, 'flex-[1_1_7rem] sm:flex-none')}>
          <option value="all">Any status</option>
          <option value="true">Published</option>
          <option value="false">Hidden</option>
        </select>
        <select
          aria-label="Placement"
          value={placement}
          onChange={(e) => setFilter(() => setPlacement(e.target.value as PlacementFilter))}
          className={cn(control, 'flex-[1_1_9rem] sm:flex-none')}
        >
          <option value="">Any placement</option>
          <option value="home">On the home page</option>
          <option value="deals">Top deals</option>
          <option value="featured">Featured</option>
          <option value="carousel">Featured row</option>
          <option value="none">Not on the home page</option>
        </select>
        <select
          aria-label="Condition"
          value={condition}
          onChange={(e) => setFilter(() => setCondition(e.target.value as typeof condition))}
          className={cn(control, 'flex-[1_1_7rem] sm:flex-none')}
        >
          <option value="">Any condition</option>
          <option value="new">New</option>
          <option value="refurbished">Refurbished</option>
          <option value="used">Used</option>
        </select>
        <select aria-label="Sort" value={sort} onChange={(e) => setFilter(() => setSort(e.target.value as typeof sort))} className={cn(control, 'flex-[1_1_9rem] sm:flex-none')}>
          <option value="placement">Storefront order</option>
          <option value="newest">Newest</option>
          <option value="name">Name A–Z</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
        </select>
        {filtered ? (
          <button
            type="button"
            className="h-9 px-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
            onClick={() =>
              setFilter(() => {
                setQ('')
                setCategory('')
                setActive('all')
                setCondition('')
                setPlacement('')
              })
            }
          >
            Clear
          </button>
        ) : null}
      </div>
      {placement === 'home' || placement === 'deals' ? (
        <p className="text-[11px] text-[var(--fg-muted)]">
          Products marked for the home page. A badge marked “waiting” is flagged but not shown yet (newer products take the limited places).
        </p>
      ) : null}

      {products.isPending && !products.data ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : products.isError ? (
        <QueryErrorState onRetry={() => products.refetch()} />
      ) : !items.length ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center">
          <p className="text-sm text-[var(--fg-muted)]">{filtered ? 'No products match these filters.' : 'No products yet.'}</p>
          {!filtered ? (
            <Link to="/admin/products/new" className="mt-3 inline-block text-sm font-medium text-[var(--brand-text)] hover:underline">
              Add your first product
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          {/* Phones */}
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] md:hidden">
            {items.map((p, i) => {
              const img = imgOf(p)
              const cat = catOf(p)
              const placements = place.placementsOf(p)
              const heading = groupHeading(i)
              return (
                <Fragment key={p._id}>
                {heading ? (
                  <li className="bg-[var(--bg-muted)] px-3 py-1.5">{heading}</li>
                ) : null}
                <li className="flex min-w-0 gap-2.5 px-3 py-2.5">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                    {img ? <SafeImage src={optimizedImageUrl(img, 160)} alt="" className="h-full w-full object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <Link to={`/admin/products/${p._id}/edit`} className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {p.name}
                          {p.variantLabel ? <span className="ms-1 font-normal text-[var(--fg-muted)]">({p.variantLabel})</span> : null}
                        </p>
                        <p className="truncate text-[11px] text-[var(--fg-muted)]">
                          {cat?.name ?? '—'} · {p.sku}
                        </p>
                      </Link>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                    </div>
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
                      <ActiveToggle product={p} size="sm" />
                      <PlacementBadges placements={placements} onMore={() => setPlacing(p)} />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setPlacing(p)}>
                        <SiteIcon name="layers" size={13} /> Placement
                      </Button>
                      <Link to={`/admin/products/${p._id}/edit`}>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                          <SiteIcon name="pencil" size={13} /> Edit
                        </Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="ms-auto h-7 px-2" aria-label="Delete product" onClick={() => setDeleteId(p._id)}>
                        <SiteIcon name="trash" size={14} />
                      </Button>
                    </div>
                  </div>
                </li>
                </Fragment>
              )
            })}
          </ul>

          {/* Tablet / desktop */}
          <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--fg-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Product</th>
                  <th className="px-3 py-2 font-medium">Category</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Storefront</th>
                  <th className="whitespace-nowrap px-3 py-2 text-right font-normal">
                    {total} product{total === 1 ? '' : 's'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map((p, i) => {
                  const img = imgOf(p)
                  const cat = catOf(p)
                  const placements = place.placementsOf(p)
                  const heading = groupHeading(i)
                  return (
                    <Fragment key={p._id}>
                    {heading ? (
                      <tr className="bg-[var(--bg-muted)]">
                        <td colSpan={6} className="px-3 py-1.5">
                          {heading}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="hover:bg-[var(--bg-muted)]">
                      <td className="max-w-[18rem] px-3 py-2">
                        <Link to={`/admin/products/${p._id}/edit`} className="flex min-w-0 items-center gap-2.5 hover:text-[var(--brand-text)]">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                            {img ? <SafeImage src={optimizedImageUrl(img, 120)} alt="" className="h-full w-full object-cover" /> : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {p.name}
                              {p.variantLabel ? <span className="ms-1 font-normal text-[var(--fg-muted)]">({p.variantLabel})</span> : null}
                            </p>
                            <p className="truncate text-[11px] text-[var(--fg-muted)]">
                              {p.sku}
                              {p.condition && p.condition !== 'new' ? ` · ${p.condition === 'used' ? 'Used' : 'Refurbished'}` : ''}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="max-w-[10rem] px-3 py-2">
                        <span className={cn('block truncate', cat?.isActive === false && 'text-[var(--warning)]')} title={cat?.isActive === false ? 'Category is hidden' : undefined}>
                          {cat?.name ?? '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <span className="font-medium tabular-nums">{formatCurrency(p.price)}</span>
                        {p.compareAtPrice && p.compareAtPrice > p.price ? (
                          <span className="block text-[11px] text-[var(--fg-muted)] line-through tabular-nums">{formatCurrency(p.compareAtPrice)}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <ActiveToggle product={p} size="sm" />
                          {p.stock <= 0 ? (
                            <Link to={`/admin/inventory/products/${p._id}`} title="Manage stock in Inventory">
                              <Badge variant="muted" className="normal-case">Out of stock</Badge>
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="max-w-[16rem] px-3 py-2">
                        <PlacementBadges placements={placements} onMore={() => setPlacing(p)} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" aria-label="Storefront placement" title="Storefront placement" onClick={() => setPlacing(p)}>
                            <SiteIcon name="layers" size={15} />
                          </Button>
                          <Link to={`/admin/products/${p._id}/edit`}>
                            <Button variant="ghost" size="sm" aria-label="Edit" title="Edit">
                              <SiteIcon name="pencil" size={15} />
                            </Button>
                          </Link>
                          <a
                            href={`/product/${p.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="View on store"
                            title="View on store"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                          >
                            <SiteIcon name="external" size={14} />
                          </a>
                          <Button variant="ghost" size="sm" aria-label="Delete" title="Delete" onClick={() => setDeleteId(p._id)}>
                            <SiteIcon name="trash" size={15} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}

      <ProductPlacementDialog product={placingLive} onClose={() => setPlacing(null)} />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete product?"
        description="This permanently removes the product from the catalog."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
        }}
      />
    </div>
  )
}
