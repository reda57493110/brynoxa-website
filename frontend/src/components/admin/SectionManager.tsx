import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductSearch, Thumb } from '@/components/admin/PageHeaderProducts'
import { MAX_HOME_DEALS } from '@/hooks/useHomeDeals'
import { HOME_FEATURED_LIMIT, HOME_ROW_LIMIT, useStorefrontPlacements } from '@/hooks/useStorefrontPlacements'
import { formatCurrency } from '@/lib/format'
import { toast } from '@/store/toastStore'
import type { Product } from '@/types'

export type ManagedSection = 'deals' | 'featured' | 'row'

const TITLES: Record<ManagedSection, string> = {
  deals: 'Home · Top deals (hero)',
  featured: 'Home · Featured card',
  row: 'Home · Featured row (carousel)',
}

const HINTS: Record<ManagedSection, string> = {
  deals: `Up to ${MAX_HOME_DEALS}, shown in this order at the very top of the home page. Sold-out or hidden ones are skipped.`,
  featured: `The first one is the big Featured card. The next ${HOME_FEATURED_LIMIT - 1} only show in the row when the carousel is empty.`,
  row: `The first ${HOME_ROW_LIMIT} are shown in this order under the Featured card.`,
}

/**
 * Manage one storefront section in place: its products in their real order, with reorder,
 * remove and add. Top deals are saved in Settings; Featured and the carousel are ordered by
 * the time each product was (re)added, so reordering re-adds them from last to first.
 * Only the placement fields change — never stock, price or other product details.
 */
export function SectionManager({ section, onClose }: { section: ManagedSection | null; onClose: () => void }) {
  const qc = useQueryClient()
  const place = useStorefrontPlacements()
  const [adding, setAdding] = useState(false)
  const flag = section === 'row' ? 'isCarousel' : 'isFeatured'

  // Every product in the section (flagged ones beyond the visible limit included), in storefront order
  const flagged = useQuery({
    queryKey: ['admin-products', 'section', section],
    queryFn: async () =>
      (
        await adminApi.products.list({
          admin: true,
          limit: 50,
          ...(section === 'row' ? { carousel: true } : { featured: true }),
        })
      ).data.data,
    enabled: section === 'featured' || section === 'row',
  })

  const dealIds = place.pinnedDeals
  const deals = useQuery({
    queryKey: ['admin-products', 'section-deals', dealIds.join(',')],
    queryFn: async () => Promise.all(dealIds.map(async (id) => (await adminApi.products.get(id)).data.data)),
    enabled: section === 'deals' && dealIds.length > 0,
  })

  const refresh = () => {
    for (const key of [
      ['admin-products'],
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

  const save = useMutation({
    mutationFn: async (action: { type: 'order'; ids: string[] } | { type: 'remove'; id: string } | { type: 'add'; id: string }) => {
      if (section === 'deals') {
        const next =
          action.type === 'order' ? action.ids : action.type === 'remove' ? dealIds.filter((x) => x !== action.id) : [...dealIds, action.id]
        await adminApi.settings.update({ homeDeals: next.slice(0, MAX_HOME_DEALS) })
        return
      }
      if (action.type === 'remove') {
        await adminApi.products.update(action.id, { [flag]: false })
        return
      }
      if (action.type === 'add') {
        // Newly added goes first (newest first), like on the product page
        await adminApi.products.update(action.id, { [flag]: true })
        return
      }
      // Re-add from last to first: each one becomes the newest, so the first ends up first
      for (const id of [...action.ids].reverse()) {
        await adminApi.products.update(id, { [flag]: true })
      }
    },
    onSuccess: () => {
      refresh()
      toast.success('Section updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (!section) return null

  const items: Product[] = section === 'deals' ? (deals.data ?? []) : (flagged.data ?? [])
  const loading = section === 'deals' ? dealIds.length > 0 && deals.isPending : flagged.isPending
  const limit = section === 'deals' ? MAX_HOME_DEALS : section === 'row' ? HOME_ROW_LIMIT : HOME_FEATURED_LIMIT
  const ids = items.map((p) => p._id)
  const full = section === 'deals' && ids.length >= MAX_HOME_DEALS

  const move = (from: number, to: number) => {
    const next = [...ids]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    save.mutate({ type: 'order', ids: next })
  }

  // Position among the products the storefront actually shows (hidden / sold-out deals skipped)
  const visible = items.map((p) => p.isActive && !(section === 'deals' && p.stock <= 0))
  const shownIndex = (i: number) => visible.slice(0, i).filter(Boolean).length

  const statusOf = (p: Product, i: number) => {
    if (!p.isActive) return <Badge variant="danger">Hidden — skipped</Badge>
    if (section === 'deals' && p.stock <= 0) return <Badge variant="danger">Sold out — skipped</Badge>
    if (section === 'featured' && shownIndex(i) === 0) return <Badge variant="brand">Featured card</Badge>
    if (shownIndex(i) >= limit) return <Badge variant="warning">Not shown (over {limit})</Badge>
    if (section === 'featured') return <span className="text-[11px] text-[var(--fg-muted)]">{place.rowFromCarousel ? 'Waiting' : 'Shown in the row'}</span>
    return <span className="text-[11px] text-[var(--success)]">Shown</span>
  }

  return (
    <Modal open={Boolean(section)} onClose={onClose} title={TITLES[section]} size="md">
      <div className="space-y-3">
        <p className="text-xs text-[var(--fg-muted)]">{HINTS[section]}</p>
        {section === 'row' && !place.rowFromCarousel ? (
          <p className="rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-xs">
            The carousel is empty, so the row shows your next featured products. Add products here to control the row.
          </p>
        ) : null}
        {section === 'deals' && !dealIds.length ? (
          <p className="rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-xs">
            Automatic: showing {place.deals.products.map((p) => p.name).join(', ') || 'your featured products'}. Add a deal to choose them yourself.
          </p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : items.length ? (
          <ol className="max-h-[50vh] space-y-1.5 overflow-y-auto pe-1">
            {items.map((p, i) => (
              <li key={p._id} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[11px] font-semibold tabular-nums">
                  {i + 1}
                </span>
                <span className="hidden sm:block">
                  <Thumb product={p} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="tabular-nums">{formatCurrency(p.price)}</span>
                    {statusOf(p, i)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <Button size="sm" variant="ghost" className="h-8 w-8 !px-0" aria-label="Move up" disabled={i === 0 || save.isPending} onClick={() => move(i, i - 1)}>
                    <SiteIcon name="arrow-up" size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 !px-0"
                    aria-label="Move down"
                    disabled={i === items.length - 1 || save.isPending}
                    onClick={() => move(i, i + 1)}
                  >
                    <SiteIcon name="arrow-up" size={14} className="rotate-180" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 !px-0 text-[var(--danger)]"
                    aria-label="Remove from section"
                    title="Remove from this section (the product is not deleted)"
                    disabled={save.isPending}
                    onClick={() => save.mutate({ type: 'remove', id: p._id })}
                  >
                    <SiteIcon name="close" size={14} />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-4 text-center text-sm text-[var(--fg-muted)]">No products in this section yet.</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant={adding ? 'ghost' : 'outline'} disabled={!adding && full} onClick={() => setAdding((v) => !v)}>
            {adding ? 'Done' : (
              <>
                <SiteIcon name="plus" size={14} /> Add a product
              </>
            )}
          </Button>
          {save.isPending ? <Spinner size="sm" /> : null}
          <span className="text-[11px] text-[var(--fg-muted)]">Changes are live on the storefront right away. Stock and prices are not touched.</span>
        </div>

        {adding ? (
          <ProductSearch
            currentId=""
            chosenIds={ids}
            actionLabel="Add"
            saving={save.isPending || full}
            onSelect={(id) => save.mutate({ type: 'add', id })}
          />
        ) : null}
      </div>
    </Modal>
  )
}
