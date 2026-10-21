import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
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
import { SectionManager, type ManagedSection } from '@/components/admin/SectionManager'
import { HomeLayoutBoard } from '@/components/admin/HomeLayoutBoard'
import { OutsidePhotosBanner } from '@/components/admin/OutsidePhotosBanner'
import { useStorefrontPlacements, type Placement } from '@/hooks/useStorefrontPlacements'
import { optimizedImageUrl } from '@/lib/image'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'
import { hasPermission } from '@/lib/permissions'
import type { Category, Product, ProductCondition } from '@/types'

type PlacementFilter = '' | 'home' | 'deals' | 'featured' | 'carousel' | 'none'

const control = 'h-9 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--fg)] outline-none ring-brand'

const SHORT: Record<string, string> = {
  deals: 'Hero',
  spotlight: 'Featured',
  row: 'Carousel',
  shopHeader: 'Shop header',
  featuredWaiting: 'Featured flag · not shown',
  carouselWaiting: 'Carousel · not shown',
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
function PlacementBadges({ placements, onMore, max = 3 }: { placements: Placement[]; onMore: () => void; max?: number }) {
  const list = placements.filter((p) => p.key !== 'category' && p.key !== 'hidden')
  if (placements.some((p) => p.key === 'hidden')) return <span className="text-xs text-[var(--fg-muted)]">—</span>
  if (!list.length) return <span className="text-xs text-[var(--fg-muted)]">Shop</span>
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

/** Table groups, in storefront order (the board above shows each home section in full). */
type Group = 'home' | 'shopHeader' | 'shop' | 'hidden'

const GROUP_LABEL: Record<Group, string> = {
  home: 'Home page',
  shopHeader: 'Shop header',
  shop: 'Shop',
  hidden: 'Hidden',
}

function groupOf(placements: Placement[]): Group {
  const shown = (key: string) => placements.some((p) => p.key === key && !p.waiting)
  if (placements.some((p) => p.key === 'hidden')) return 'hidden'
  if (shown('deals') || shown('spotlight') || shown('row')) return 'home'
  if (shown('shopHeader')) return 'shopHeader'
  return 'shop'
}

export function Products() {
  const role = useAuthStore((s) => s.user?.role)
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
  const [managing, setManaging] = useState<ManagedSection | null>(null)
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
  const groupHeading = (i: number) =>
    sort === 'placement' && place.ready && (i === 0 || groups[i] !== groups[i - 1]) ? (
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{GROUP_LABEL[groups[i]]}</span>
    ) : null

  const canSeeCosts = hasPermission(role, 'reports')
  const canEditProducts = hasPermission(role, 'products:write')
  const imgOf = (p: Product) => p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
  const catOf = (p: Product) => (typeof p.category === 'object' && p.category ? p.category : null)

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">Products</h1>
        <div className="flex shrink-0 gap-2">
          {canSeeCosts ? (
            <Link to="/admin/profit">
              <Button size="sm" variant="outline">
                <SiteIcon name="banknote" size={15} /> Costs & profit
              </Button>
            </Link>
          ) : null}
          <Link to="/admin/products/new">
            <Button size="sm">
              <SiteIcon name="plus" size={15} /> Add product
            </Button>
          </Link>
        </div>
      </div>

      {canEditProducts ? <OutsidePhotosBanner /> : null}

      {/* The home page, section by section, exactly as customers see it */}
      <HomeLayoutBoard onManage={setManaging} onOpen={setPlacing} />

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
          <option value="home">Home page</option>
          <option value="deals">Hero</option>
          <option value="featured">Featured</option>
          <option value="carousel">Carousel</option>
          <option value="none">Not on home page</option>
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

      {products.isPending && !products.data ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : products.isError ? (
        <QueryErrorState onRetry={() => products.refetch()} />
      ) : !items.length ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center">
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
                      <Button size="sm" variant="ghost" className="h-7 w-8 !px-0" aria-label="Placement" onClick={() => setPlacing(p)}>
                        <SiteIcon name="layers" size={14} />
                      </Button>
                      <Link to={`/admin/products/${p._id}/edit`} aria-label="Edit">
                        <Button size="sm" variant="ghost" className="h-7 w-8 !px-0">
                          <SiteIcon name="pencil" size={14} />
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
      <SectionManager section={managing} onClose={() => setManaging(null)} />

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
