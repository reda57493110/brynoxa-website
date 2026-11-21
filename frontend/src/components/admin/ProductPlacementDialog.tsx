import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ActiveToggle } from '@/components/admin/ActiveToggle'
import { ProductAutoPlaces } from '@/components/admin/ProductAutoPlaces'
import { MAX_HOME_DEALS } from '@/hooks/useHomeDeals'
import { HOME_ROW_LIMIT, useStorefrontPlacements } from '@/hooks/useStorefrontPlacements'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import { useAdminT } from '@/store/adminLangStore'
import type { Category, Product } from '@/types'

/** Invalidate everything that shows placement (admin lists and the storefront's own queries). */
function useRefreshPlacement() {
  const qc = useQueryClient()
  return () => {
    for (const key of [
      ['admin-products'],
      ['admin-product'],
      ['products', 'featured'],
      ['products', 'carousel'],
      ['settings'],
      ['admin-settings'],
      ['home-deals'],
      ['home-deals-auto'],
      ['hero-product'],
      ['hero-auto-products'],
    ]) {
      qc.invalidateQueries({ queryKey: key })
    }
  }
}

function Row({
  title,
  status,
  tone = 'muted',
  children,
}: {
  title: string
  status: string
  tone?: 'on' | 'muted' | 'warn'
  children: React.ReactNode
}) {
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p
          className={cn(
            'text-xs',
            tone === 'on' ? 'text-[var(--success)]' : tone === 'warn' ? 'text-[var(--warning)]' : 'text-[var(--fg-muted)]'
          )}
        >
          {status}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1.5">{children}</div>
    </li>
  )
}

/**
 * Where one product appears on the storefront, and the controls to change it. Every control
 * writes the real setting (product flags, Settings → home deals / shop header, category);
 * none of them touch stock, price or other product details.
 */
export function ProductPlacementDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const tr = useAdminT()
  const place = useStorefrontPlacements()
  const refresh = useRefreshPlacement()
  const cats = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data,
    enabled: Boolean(product),
  })

  const updateProduct = useMutation({
    mutationFn: (payload: Partial<Product>) => adminApi.products.update(product!._id, payload),
    onSuccess: () => {
      refresh()
      toast.success(tr('products.dlg.updated'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const updateSettings = useMutation({
    mutationFn: (payload: { homeDeals?: string[]; categoryHeroes?: Record<string, string> }) => adminApi.settings.update(payload),
    onSuccess: () => {
      refresh()
      toast.success(tr('products.dlg.updated'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (!product) return null
  const p = product
  const busy = updateProduct.isPending || updateSettings.isPending
  const placements = place.placementsOf(p)
  const has = (key: string) => placements.some((x) => x.key === key && !x.waiting)
  const category = typeof p.category === 'object' && p.category ? p.category : null

  // Home deals
  const pinned = place.pinnedDeals
  const inDeals = pinned.includes(p._id)
  const dealIndex = place.deals.products.findIndex((d) => d._id === p._id)
  const dealsStatus = inDeals
    ? dealIndex >= 0
      ? `#${dealIndex + 1}`
      : tr('products.dlg.skipped')
    : dealIndex >= 0
      ? tr('products.dlg.autoRank', { n: dealIndex + 1 })
      : tr('products.dlg.off')

  // Featured card / row
  const isSpotlight = place.featuredList[0]?._id === p._id
  const rowIndex = place.row.findIndex((r) => r._id === p._id)
  const featuredStatus = !p.isFeatured
    ? tr('products.dlg.off')
    : isSpotlight
      ? tr('products.dlg.shown')
      : !place.rowFromCarousel && rowIndex >= 0
        ? tr('products.dlg.inCarousel', { n: rowIndex + 1 })
        : dealIndex >= 0 && !inDeals
          ? tr('products.dlg.feedsHero')
          : tr('products.dlg.flagNotShown')
  const carouselStatus = !p.isCarousel
    ? tr('products.dlg.off')
    : place.rowFromCarousel && rowIndex >= 0
      ? `#${rowIndex + 1}`
      : tr('products.dlg.notShownOver', { max: HOME_ROW_LIMIT })


  return (
    <Modal open={Boolean(product)} onClose={onClose} title={tr('products.placement')} size="md">
      <div className="space-y-4">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{p.name}</p>
            <p className="truncate text-xs text-[var(--fg-muted)]">{p.sku}</p>
          </div>
          <ActiveToggle product={p} size="sm" />
        </div>

        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] px-3">
          <Row
            title={tr('products.category')}
            status={
              !p.isActive
                ? tr('products.dlg.productHidden')
                : category?.isActive === false
                  ? tr('products.dlg.categoryHidden')
                  : tr('products.dlg.listed')
            }
            tone={p.isActive && category?.isActive !== false ? 'on' : 'warn'}
          >
            <select
              aria-label={tr('products.category')}
              value={category?._id ?? ''}
              disabled={busy}
              onChange={(e) => e.target.value && updateProduct.mutate({ category: e.target.value as never })}
              className="h-8 max-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs"
            >
              {(cats.data as Category[] | undefined)?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.isActive === false ? ` ${tr('products.hiddenSuffix')}` : ''}
                </option>
              ))}
            </select>
          </Row>

          <Row title={tr('products.short.deals')} status={dealsStatus} tone={dealIndex >= 0 ? 'on' : inDeals ? 'warn' : 'muted'}>
            {inDeals ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => updateSettings.mutate({ homeDeals: pinned.filter((x) => x !== p._id) })}>
                {tr('products.remove')}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busy || pinned.length >= MAX_HOME_DEALS || !p.isActive}
                title={pinned.length >= MAX_HOME_DEALS ? tr('products.dlg.dealsFull', { max: MAX_HOME_DEALS }) : undefined}
                onClick={() => updateSettings.mutate({ homeDeals: [...pinned, p._id] })}
              >
                <SiteIcon name="plus" size={13} /> {tr('products.add')}
              </Button>
            )}
          </Row>

          <Row title={tr('products.dlg.topFirst')} status={featuredStatus} tone={has('spotlight') || (has('row') && !place.rowFromCarousel) ? 'on' : p.isFeatured ? 'warn' : 'muted'}>
            {p.isFeatured && !isSpotlight ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => updateProduct.mutate({ isFeatured: true })}>
                {tr('products.dlg.makeFeatured')}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={p.isFeatured ? 'ghost' : 'outline'}
              disabled={busy}
              onClick={() => updateProduct.mutate({ isFeatured: !p.isFeatured })}
            >
              {p.isFeatured ? tr('products.remove') : tr('products.dlg.feature')}
            </Button>
          </Row>

          <Row title={tr('products.dlg.topThen')} status={carouselStatus} tone={place.rowFromCarousel && rowIndex >= 0 ? 'on' : p.isCarousel ? 'warn' : 'muted'}>
            {p.isCarousel && rowIndex !== 0 ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => updateProduct.mutate({ isCarousel: true })}>
                {tr('products.dlg.showFirst')}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={p.isCarousel ? 'ghost' : 'outline'}
              disabled={busy}
              onClick={() => updateProduct.mutate({ isCarousel: !p.isCarousel })}
            >
              {p.isCarousel ? tr('products.remove') : tr('products.add')}
            </Button>
          </Row>

        </ul>

        {/* The sections that fill themselves: where it shows, and why not (with the fix) */}
        <ProductAutoPlaces product={p} />

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-text)] hover:underline">
            {tr('products.dlg.productPage')} <SiteIcon name="external" size={11} />
          </a>
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-text)] hover:underline">
            {tr('products.dlg.home')} <SiteIcon name="external" size={11} />
          </a>
          {category ? (
            <a href={`/category/${category.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-text)] hover:underline">
              {category.name} <SiteIcon name="external" size={11} />
            </a>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
