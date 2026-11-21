import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
import { StoredPhotosBanner } from '@/components/admin/StoredPhotosBanner'
import { useStorefrontPlacements, type Placement } from '@/hooks/useStorefrontPlacements'
import { optimizedImageUrl } from '@/lib/image'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import { useAuthStore } from '@/store/authStore'
import { hasPermission } from '@/lib/permissions'
import { useAdminT } from '@/store/adminLangStore'
import { at } from '@/i18n/admin'
import type { Category, Product, ProductCondition } from '@/types'
import { mainCategories, withSubCategories } from '@/lib/categoryTree'

type PlacementFilter = '' | 'home' | 'deals' | 'featured' | 'carousel' | 'none'

const control = 'h-9 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--fg)] outline-none ring-brand'

/** Short badge names, in the admin language (read when rendering) */
const short = (): Record<string, string> => ({
  deals: at('products.short.deals'),
  spotlight: at('products.short.topPicks'),
  row: at('products.short.topPicks'),
  featuredWaiting: at('products.short.featuredWaiting'),
  carouselWaiting: at('products.short.carouselWaiting'),
})

function badgeFor(pl: Placement): { text: string; variant: BadgeVariant; title: string } {
  const text = `${short()[pl.key] ?? pl.label}${pl.detail && !pl.waiting ? ` ${pl.detail}` : ''}`
  return {
    text,
    variant: pl.waiting ? 'warning' : 'brand',
    title: `${pl.label}${pl.detail ? ` — ${pl.detail}` : ''}${pl.auto ? ` (${at('products.automatic')})` : ''}`,
  }
}

/** Home / shop placements as small badges (category is shown in its own column). */
function PlacementBadges({ placements, onMore, max = 3 }: { placements: Placement[]; onMore: () => void; max?: number }) {
  const list = placements.filter((p) => p.key !== 'category' && p.key !== 'hidden')
  if (placements.some((p) => p.key === 'hidden')) return <span className="text-xs text-[var(--fg-muted)]">—</span>
  if (!list.length) return <span className="text-xs text-[var(--fg-muted)]">{at('products.shop')}</span>
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
type Group = 'home' | 'shop' | 'hidden'

const groupLabel = (g: Group) => at(g === 'home' ? 'products.homePage' : g === 'shop' ? 'products.shop' : 'products.hidden')

function groupOf(placements: Placement[]): Group {
  const shown = (key: string) => placements.some((p) => p.key === key && !p.waiting)
  if (placements.some((p) => p.key === 'hidden')) return 'hidden'
  if (shown('deals') || shown('spotlight') || shown('row')) return 'home'
  return 'shop'
}

export function Products() {
  const role = useAuthStore((s) => s.user?.role)
  const tr = useAdminT()
  const qc = useQueryClient()
  // ?q= from the admin search ("See all products matching…")
  const [q, setQ] = useState(() => new URLSearchParams(window.location.search).get('q') ?? '')
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all')
  const [condition, setCondition] = useState<ProductCondition | ''>('')
  const [placement, setPlacement] = useState<PlacementFilter>('')
  // Default: the storefront's own order (home page top to bottom, then the rest of the shop)
  const [sort, setSort] = useState<'placement' | 'newest' | 'name' | 'price_asc' | 'price_desc'>('placement')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [placing, setPlacing] = useState<Product | null>(null)
  // Just created (Add product → Save): open its placement window once
  const location = useLocation()
  const navigateTo = useNavigate()
  const placeNew = (location.state as { placeNew?: string } | null)?.placeNew
  useEffect(() => {
    if (!placeNew) return
    adminApi.products
      .get(placeNew)
      .then((r) => {
        if (r.data.data) setPlacing(r.data.data)
      })
      .catch(() => undefined)
    // Not again on reload / back
    navigateTo(location.pathname + location.search, { replace: true, state: null })
  }, [placeNew]) // eslint-disable-line react-hooks/exhaustive-deps
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
      toast.success(tr('products.deleted'))
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
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{groupLabel(groups[i])}</span>
    ) : null

  const canSeeCosts = hasPermission(role, 'reports')
  const canEditProducts = hasPermission(role, 'products:write')
  const imgOf = (p: Product) => p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
  const catOf = (p: Product) => (typeof p.category === 'object' && p.category ? p.category : null)

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">{tr('products.title')}</h1>
        <div className="flex shrink-0 gap-2">
          {canSeeCosts ? (
            <Link to="/admin/profit">
              <Button size="sm" variant="outline">
                <SiteIcon name="banknote" size={15} /> {tr('products.costsProfit')}
              </Button>
            </Link>
          ) : null}
          <Link to="/admin/products/new">
            <Button size="sm">
              <SiteIcon name="plus" size={15} /> {tr('products.addProduct')}
            </Button>
          </Link>
        </div>
      </div>

      {canEditProducts ? <OutsidePhotosBanner /> : null}
      {canEditProducts ? <StoredPhotosBanner /> : null}

      {/* The home page, section by section, exactly as customers see it */}
      <HomeLayoutBoard onManage={setManaging} onOpen={setPlacing} />

      {/* Toolbar */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="relative min-w-0 basis-full sm:flex-[1_1_14rem] sm:basis-auto">
          <SiteIcon name="search" size={15} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="search"
            aria-label={tr('products.searchLabel')}
            placeholder={tr('products.searchPlaceholder')}
            value={q}
            onChange={(e) => setFilter(() => setQ(e.target.value))}
            className={cn(control, 'w-full ps-8')}
          />
        </div>
        <select aria-label={tr('products.category')} value={category} onChange={(e) => setFilter(() => setCategory(e.target.value))} className={cn(control, 'flex-[1_1_8rem] sm:flex-none')}>
          <option value="">{tr('products.allCategories')}</option>
          {/* Each main category, then its sub-categories (indented) */}
          {withSubCategories(mainCategories((cats.data as Category[] | undefined) ?? []), (cats.data as Category[] | undefined) ?? []).map((c) => (
            <option key={c._id} value={c._id}>
              {c.parent ? `  ↳ ${c.name}` : c.name}
            </option>
          ))}
        </select>
        <select aria-label={tr('common.status')} value={active} onChange={(e) => setFilter(() => setActive(e.target.value as typeof active))} className={cn(control, 'flex-[1_1_7rem] sm:flex-none')}>
          <option value="all">{tr('products.anyStatus')}</option>
          <option value="true">{tr('products.published')}</option>
          <option value="false">{tr('products.hidden')}</option>
        </select>
        <select
          aria-label={tr('products.placement')}
          value={placement}
          onChange={(e) => setFilter(() => setPlacement(e.target.value as PlacementFilter))}
          className={cn(control, 'flex-[1_1_9rem] sm:flex-none')}
        >
          <option value="">{tr('products.anyPlacement')}</option>
          <option value="home">{tr('products.homePage')}</option>
          <option value="deals">{tr('products.hero')}</option>
          <option value="featured">{tr('products.featured')}</option>
          <option value="carousel">{tr('products.carousel')}</option>
          <option value="none">{tr('products.notOnHome')}</option>
        </select>
        <select
          aria-label={tr('products.condition')}
          value={condition}
          onChange={(e) => setFilter(() => setCondition(e.target.value as typeof condition))}
          className={cn(control, 'flex-[1_1_7rem] sm:flex-none')}
        >
          <option value="">{tr('products.anyCondition')}</option>
          <option value="new">{tr('products.condNew')}</option>
          <option value="refurbished">{tr('products.condRefurbished')}</option>
          <option value="used">{tr('products.condUsed')}</option>
        </select>
        <select aria-label={tr('products.sort')} value={sort} onChange={(e) => setFilter(() => setSort(e.target.value as typeof sort))} className={cn(control, 'flex-[1_1_9rem] sm:flex-none')}>
          <option value="placement">{tr('products.sortStorefront')}</option>
          <option value="newest">{tr('products.sortNewest')}</option>
          <option value="name">{tr('products.sortName')}</option>
          <option value="price_asc">{tr('products.sortPriceAsc')}</option>
          <option value="price_desc">{tr('products.sortPriceDesc')}</option>
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
            {tr('products.clear')}
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
          <p className="text-sm text-[var(--fg-muted)]">{filtered ? tr('products.noMatch') : tr('products.noProducts')}</p>
          {!filtered ? (
            <Link to="/admin/products/new" className="mt-3 inline-block text-sm font-medium text-[var(--brand-text)] hover:underline">
              {tr('products.addFirst')}
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
                      <Button size="sm" variant="ghost" className="h-7 w-8 !px-0" aria-label={tr('products.placement')} onClick={() => setPlacing(p)}>
                        <SiteIcon name="layers" size={14} />
                      </Button>
                      <Link to={`/admin/products/${p._id}/edit`} aria-label={tr('products.edit')}>
                        <Button size="sm" variant="ghost" className="h-7 w-8 !px-0">
                          <SiteIcon name="pencil" size={14} />
                        </Button>
                      </Link>
                      <Button size="sm" variant="ghost" className="ms-auto h-7 px-2" aria-label={tr('products.deleteProduct')} onClick={() => setDeleteId(p._id)}>
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
            <table className="w-full min-w-[820px] text-start text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--fg-muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">{tr('products.colProduct')}</th>
                  <th className="px-3 py-2 font-medium">{tr('products.category')}</th>
                  <th className="px-3 py-2 text-end font-medium">{tr('products.colPrice')}</th>
                  <th className="px-3 py-2 font-medium">{tr('common.status')}</th>
                  <th className="px-3 py-2 font-medium">{tr('products.colStorefront')}</th>
                  <th className="whitespace-nowrap px-3 py-2 text-end font-normal">
                    {total === 1 ? tr('products.countOne') : tr('products.count', { count: total })}
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
                              {p.condition && p.condition !== 'new' ? ` · ${p.condition === 'used' ? tr('products.condUsed') : tr('products.condRefurbished')}` : ''}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="max-w-[10rem] px-3 py-2">
                        <span className={cn('block truncate', cat?.isActive === false && 'text-[var(--warning)]')} title={cat?.isActive === false ? tr('products.categoryHidden') : undefined}>
                          {cat?.name ?? '—'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-end">
                        <span className="font-medium tabular-nums">{formatCurrency(p.price)}</span>
                        {p.compareAtPrice && p.compareAtPrice > p.price ? (
                          <span className="block text-[11px] text-[var(--fg-muted)] line-through tabular-nums">{formatCurrency(p.compareAtPrice)}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <ActiveToggle product={p} size="sm" />
                          {p.stock <= 0 ? (
                            <Link to={`/admin/inventory/products/${p._id}`} title={tr('products.manageStock')}>
                              <Badge variant="muted" className="normal-case">{tr('products.outOfStock')}</Badge>
                            </Link>
                          ) : null}
                        </div>
                      </td>
                      <td className="max-w-[16rem] px-3 py-2">
                        <PlacementBadges placements={placements} onMore={() => setPlacing(p)} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end">
                          <Button variant="ghost" size="sm" aria-label={tr('products.storefrontPlacement')} title={tr('products.storefrontPlacement')} onClick={() => setPlacing(p)}>
                            <SiteIcon name="layers" size={15} />
                          </Button>
                          <Link to={`/admin/products/${p._id}/edit`}>
                            <Button variant="ghost" size="sm" aria-label={tr('products.edit')} title={tr('products.edit')}>
                              <SiteIcon name="pencil" size={15} />
                            </Button>
                          </Link>
                          <a
                            href={`/product/${p.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={tr('products.viewOnStore')}
                            title={tr('products.viewOnStore')}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                          >
                            <SiteIcon name="external" size={14} />
                          </a>
                          <Button variant="ghost" size="sm" aria-label={tr('products.delete')} title={tr('products.delete')} onClick={() => setDeleteId(p._id)}>
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
        title={tr('products.deleteTitle')}
        description={tr('products.deleteDesc')}
        confirmLabel={tr('products.delete')}
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
        }}
      />
    </div>
  )
}
