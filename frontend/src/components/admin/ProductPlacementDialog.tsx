import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ActiveToggle } from '@/components/admin/ActiveToggle'
import { MAX_HOME_DEALS } from '@/hooks/useHomeDeals'
import { HOME_ROW_LIMIT, useStorefrontPlacements } from '@/hooks/useStorefrontPlacements'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
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
      toast.success('Placement updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const updateSettings = useMutation({
    mutationFn: (payload: { homeDeals?: string[]; pageHeroProducts?: { shop: string } }) => adminApi.settings.update(payload),
    onSuccess: () => {
      refresh()
      toast.success('Placement updated')
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
      ? `Shown #${dealIndex + 1} of ${place.deals.products.length}`
      : 'Chosen, but skipped (sold out or hidden)'
    : dealIndex >= 0
      ? `Shown #${dealIndex + 1} automatically (no deals chosen in Settings)`
      : pinned.length
        ? 'Not in the deals'
        : 'Not in the deals (automatic: in-stock featured products, biggest discounts first)'

  // Featured card / row
  const isSpotlight = place.featuredList[0]?._id === p._id
  const rowIndex = place.row.findIndex((r) => r._id === p._id)
  const featuredStatus = !p.isFeatured
    ? 'Off'
    : isSpotlight
      ? 'Shown as the big Featured card'
      : !place.rowFromCarousel && rowIndex >= 0
        ? `Shown in the Featured row #${rowIndex + 1}`
        : 'On, but not shown — the newest featured product takes the card'
  const carouselStatus = !p.isCarousel
    ? 'Off'
    : place.rowFromCarousel && rowIndex >= 0
      ? `Shown #${rowIndex + 1} of ${place.row.length}`
      : `On, but not shown — only the ${HOME_ROW_LIMIT} newest are shown`

  // Shop header
  const isShopHeader = place.shopHero.product?._id === p._id
  const shopPinned = place.shopHeroSetting === p._id

  return (
    <Modal open={Boolean(product)} onClose={onClose} title="Storefront placement" size="md">
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
            title="Category page"
            status={
              !p.isActive
                ? 'Hidden products are not shown anywhere'
                : category?.isActive === false
                  ? `${category.name} is hidden, so this product is not listed`
                  : `Listed in ${category?.name ?? '—'} and in the Shop`
            }
            tone={p.isActive && category?.isActive !== false ? 'on' : 'warn'}
          >
            <select
              aria-label="Category"
              value={category?._id ?? ''}
              disabled={busy}
              onChange={(e) => e.target.value && updateProduct.mutate({ category: e.target.value as never })}
              className="h-8 max-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs"
            >
              {(cats.data as Category[] | undefined)?.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                  {c.isActive === false ? ' (hidden)' : ''}
                </option>
              ))}
            </select>
          </Row>

          <Row title="Home · Top deals" status={dealsStatus} tone={dealIndex >= 0 ? 'on' : inDeals ? 'warn' : 'muted'}>
            {inDeals ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => updateSettings.mutate({ homeDeals: pinned.filter((x) => x !== p._id) })}>
                Remove
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busy || pinned.length >= MAX_HOME_DEALS || !p.isActive}
                title={pinned.length >= MAX_HOME_DEALS ? `Already ${MAX_HOME_DEALS} deals — remove one first` : undefined}
                onClick={() => updateSettings.mutate({ homeDeals: [...pinned, p._id] })}
              >
                <SiteIcon name="plus" size={13} /> Add
              </Button>
            )}
          </Row>

          <Row title="Home · Featured" status={featuredStatus} tone={has('spotlight') || (has('row') && !place.rowFromCarousel) ? 'on' : p.isFeatured ? 'warn' : 'muted'}>
            {p.isFeatured && !isSpotlight ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => updateProduct.mutate({ isFeatured: true })}>
                Show first
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={p.isFeatured ? 'ghost' : 'outline'}
              disabled={busy}
              onClick={() => updateProduct.mutate({ isFeatured: !p.isFeatured })}
            >
              {p.isFeatured ? 'Remove' : 'Feature'}
            </Button>
          </Row>

          <Row title="Home · Featured row" status={carouselStatus} tone={place.rowFromCarousel && rowIndex >= 0 ? 'on' : p.isCarousel ? 'warn' : 'muted'}>
            {p.isCarousel && rowIndex !== 0 ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => updateProduct.mutate({ isCarousel: true })}>
                Show first
              </Button>
            ) : null}
            <Button
              size="sm"
              variant={p.isCarousel ? 'ghost' : 'outline'}
              disabled={busy}
              onClick={() => updateProduct.mutate({ isCarousel: !p.isCarousel })}
            >
              {p.isCarousel ? 'Remove' : 'Add'}
            </Button>
          </Row>

          <Row
            title="Shop · Header"
            status={isShopHeader ? (shopPinned ? 'Shown at the top of the Shop page' : 'Shown automatically (first featured product)') : 'Not the Shop header'}
            tone={isShopHeader ? 'on' : 'muted'}
          >
            {shopPinned ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => updateSettings.mutate({ pageHeroProducts: { shop: '' } })}>
                Use automatic
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled={busy || !p.isActive} onClick={() => updateSettings.mutate({ pageHeroProducts: { shop: p._id } })}>
                Use as header
              </Button>
            )}
          </Row>
        </ul>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[var(--fg-muted)]">See it:</span>
          <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-text)] hover:underline">
            Product page <SiteIcon name="external" size={11} />
          </a>
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-text)] hover:underline">
            Home <SiteIcon name="external" size={11} />
          </a>
          {category ? (
            <a href={`/category/${category.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand-text)] hover:underline">
              {category.name} <SiteIcon name="external" size={11} />
            </a>
          ) : null}
        </div>

        <p className="flex items-start gap-1.5 text-[11px] text-[var(--fg-muted)]">
          <Badge variant="muted" className="normal-case">Note</Badge>
          Placement never changes stock or price. Order the top deals in Settings → Storefront; stock is managed in Inventory.
        </p>
      </div>
    </Modal>
  )
}
