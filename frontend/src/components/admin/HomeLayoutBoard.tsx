import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { ProductSearch } from '@/components/admin/PageHeaderProducts'
import { MAX_HOME_DEALS } from '@/hooks/useHomeDeals'
import { HOME_FEATURED_LIMIT, HOME_ROW_LIMIT, useStorefrontPlacements } from '@/hooks/useStorefrontPlacements'
import { useHomeRows, type HomeRowKey } from '@/hooks/useHomeRows'
import { HOME_ROW_MIN } from '@/components/home/HomeProductRow'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { Product } from '@/types'

/** How a section is saved: Settings lists (Hero, Deals, New, budget tabs) or product flags (Featured, Carousel). */
type Store = { kind: 'homeDeals' } | { kind: 'homeRows'; key: HomeRowKey } | { kind: 'flag'; flag: 'isFeatured' | 'isCarousel' }

const iconBtn =
  'inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] disabled:pointer-events-none disabled:opacity-30'

function Tile({
  product,
  index,
  count,
  busy,
  onOpen,
  onMove,
  onRemove,
}: {
  product: Product
  index: number
  count: number
  busy: boolean
  onOpen: (p: Product) => void
  onMove: (from: number, to: number) => void
  onRemove: (id: string) => void
}) {
  const navigate = useNavigate()
  const image = product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url
  return (
    <div className="flex w-[7.5rem] shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg)] transition hover:border-[var(--brand)]">
      <button type="button" onClick={() => onOpen(product)} title={product.name} className="group text-start">
        <span className={cn('relative block h-16 w-full overflow-hidden', imageFit(image) === 'contain' ? 'bg-white' : 'bg-[var(--bg-muted)]')}>
          {image ? (
            <SafeImage
              src={sizedImageUrl(image, 240)}
              alt=""
              referrerPolicy="no-referrer"
              className={cn('h-full w-full', imageFit(image) === 'contain' ? 'object-contain p-1 mix-blend-multiply' : 'object-cover')}
            />
          ) : null}
          <span className="absolute start-1 top-1 rounded bg-[var(--brand)] px-1 text-[10px] font-bold leading-4 text-[var(--brand-fg)]">#{index + 1}</span>
        </span>
        <span className="block px-1.5 pt-1">
          <span className="block truncate text-[11px] font-medium group-hover:text-[var(--brand-text)]">{product.name}</span>
          <span className="block text-[10px] tabular-nums text-[var(--fg-muted)]">{formatCurrency(product.price)}</span>
        </span>
      </button>
      {/* Rank, edit, remove from this section */}
      <span className="flex items-center justify-between px-0.5 pb-0.5">
        <button type="button" className={iconBtn} title="Move left" aria-label="Move left" disabled={busy || index === 0} onClick={() => onMove(index, index - 1)}>
          <SiteIcon name="chevron-left" size={13} />
        </button>
        <button type="button" className={iconBtn} title="Move right" aria-label="Move right" disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)}>
          <SiteIcon name="chevron-right" size={13} />
        </button>
        <button type="button" className={iconBtn} title="Edit the product" aria-label="Edit the product" onClick={() => navigate(`/admin/products/${product._id}/edit`)}>
          <SiteIcon name="pencil" size={12} />
        </button>
        <button
          type="button"
          className={cn(iconBtn, 'hover:text-[var(--danger)]')}
          title="Remove from this section (the product stays in the shop)"
          aria-label="Remove from this section"
          disabled={busy}
          onClick={() => onRemove(product._id)}
        >
          <SiteIcon name="close" size={13} />
        </button>
      </span>
    </div>
  )
}

/** One home section: its products in order, with rank / edit / remove on each and "+ Add" at the end. */
function Section({
  icon,
  title,
  note,
  products,
  store,
  max,
  pinned,
  canReset,
  onOpen,
  empty,
}: {
  icon: SiteIconName
  title: string
  note?: string
  products: Product[]
  store: Store
  max: number
  /** Chosen by staff (not automatic) */
  pinned?: boolean
  /** Shows "Back to automatic" while pinned */
  canReset?: boolean
  onOpen: (p: Product) => void
  empty: string
}) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const ids = products.map((p) => p._id)

  const save = useMutation({
    mutationFn: async ({ next, removed }: { next: string[]; removed?: string }) => {
      if (store.kind === 'homeDeals') return adminApi.settings.update({ homeDeals: next.slice(0, max) })
      if (store.kind === 'homeRows') return adminApi.settings.update({ homeRows: { [store.key]: next.slice(0, max) } })
      // Featured / Carousel follow the time each product was (re)added: re-add from last to first
      if (removed) await adminApi.products.update(removed, { [store.flag]: false })
      for (const id of [...next].reverse()) await adminApi.products.update(id, { [store.flag]: true })
    },
    onSuccess: () => {
      for (const key of [['admin-products'], ['products'], ['settings'], ['admin-settings'], ['home-deals'], ['home-deals-auto'], ['hero-product'], ['hero-auto-products']]) {
        qc.invalidateQueries({ queryKey: key })
      }
      toast.success('Home page updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const busy = save.isPending
  const full = ids.length >= max

  const move = (from: number, to: number) => {
    const next = [...ids]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    save.mutate({ next })
  }

  return (
    <div className="min-w-0 max-w-full">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <SiteIcon name={icon} size={13} className="shrink-0 text-[var(--brand-text)]" />
        <p className="truncate text-xs font-semibold">{title}</p>
        <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)]">{products.length}</span>
        <span className="rounded-full border border-[var(--border)] px-1.5 text-[10px] text-[var(--fg-muted)]">{pinned ? 'your choice' : note ?? 'auto'}</span>
        {pinned && canReset ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => save.mutate({ next: [] })}
            className="text-[10px] font-medium text-[var(--brand-text)] hover:underline disabled:opacity-50"
          >
            Back to automatic
          </button>
        ) : null}
        {busy ? <Spinner size="sm" /> : null}
      </div>
      <div className="-mx-1 mt-1.5 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {products.map((p, i) => (
          <Tile
            key={p._id}
            product={p}
            index={i}
            count={products.length}
            busy={busy}
            onOpen={onOpen}
            onMove={move}
            onRemove={(id) => save.mutate({ next: ids.filter((x) => x !== id), removed: id })}
          />
        ))}
        <button
          type="button"
          disabled={busy || full}
          onClick={() => setAdding(true)}
          title={full ? `Full (${max} at most)` : 'Add a product to this section'}
          className="flex min-h-[7.25rem] w-[7.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border)] text-[11px] font-medium text-[var(--brand-text)] transition hover:border-[var(--brand)] disabled:opacity-40"
        >
          <SiteIcon name="plus" size={16} />
          {full ? `Full (${max})` : 'Add'}
        </button>
      </div>
      {!products.length ? <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{empty}</p> : null}
      <Modal open={adding} onClose={() => setAdding(false)} title={`Add to ${title}`} size="md">
        <ProductSearch
          currentId=""
          chosenIds={ids}
          actionLabel="Add"
          saving={busy || full}
          onSelect={(id) => save.mutate({ next: [...ids, id] }, { onSuccess: () => setAdding(false) })}
        />
      </Modal>
    </div>
  )
}

/**
 * The home page exactly as customers see it, section by section, top to bottom: Hero (top deals),
 * Featured (#1 is the big card), Carousel, Deals, New arrivals, Shop by budget (one line per price
 * tab), plus the Shop page header. Each product shows its rank and can be moved, edited or removed
 * from the section; "+ Add" adds one. Automatic sections become "your choice" once changed.
 */
export function HomeLayoutBoard({ onOpen }: { onManage?: unknown; onOpen: (p: Product) => void }) {
  const place = useStorefrontPlacements()
  const rows = useHomeRows([...place.deals.products, ...place.featuredList, ...place.row])

  if (!place.ready || !rows.ready) {
    return (
      <div className="flex justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] py-6">
        <Spinner />
      </div>
    )
  }

  // The home page hides a row with fewer than 4 products: say so here
  const rowNote = (n: number) => (n < HOME_ROW_MIN ? `auto · hidden (needs ${HOME_ROW_MIN})` : 'auto')
  const amount = (n: number) => new Intl.NumberFormat('en-US').format(n)
  const bandTitle = (b: { min?: number; max?: number }) =>
    b.min === undefined ? `Under ${amount(b.max!)} DH` : b.max === undefined ? `Over ${amount(b.min)} DH` : `${amount(b.min)} – ${amount(b.max)} DH`

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Home page</h2>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--brand-text)] hover:underline">
          View <SiteIcon name="external" size={11} />
        </a>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-4">
        <Section
          icon="tag"
          title="Hero"
          pinned={place.pinnedDeals.length > 0}
          canReset
          products={place.deals.products}
          store={{ kind: 'homeDeals' }}
          max={MAX_HOME_DEALS}
          onOpen={onOpen}
          empty="No deals."
        />
        <Section
          icon="star"
          title="Featured (#1 = big card)"
          note="your choice"
          products={place.featuredList}
          store={{ kind: 'flag', flag: 'isFeatured' }}
          max={HOME_FEATURED_LIMIT}
          onOpen={onOpen}
          empty="No featured product."
        />
        <Section
          icon="layers"
          title="Carousel"
          note={place.rowFromCarousel ? 'your choice' : 'empty: shows featured'}
          products={place.rowFromCarousel ? place.row : []}
          store={{ kind: 'flag', flag: 'isCarousel' }}
          max={HOME_ROW_LIMIT}
          onOpen={onOpen}
          empty="Empty: the home page shows your next featured products instead."
        />
        <Section
          icon="tag"
          title="Deals"
          note={rowNote(rows.deals.length)}
          pinned={rows.dealsPinned}
          canReset
          products={rows.deals}
          store={{ kind: 'homeRows', key: 'deals' }}
          max={12}
          onOpen={onOpen}
          empty="No deals: give a product an old price higher than its price, or add one."
        />
        <Section
          icon="clock"
          title="New arrivals"
          note={rowNote(rows.newArrivals.length)}
          pinned={rows.newPinned}
          canReset
          products={rows.newArrivals}
          store={{ kind: 'homeRows', key: 'new' }}
          max={12}
          onOpen={onOpen}
          empty="Nothing new that is not already shown above."
        />
        {rows.budgets.map((b) => (
          <Section
            key={b.id}
            icon="banknote"
            title={`Budget · ${bandTitle(b)}`}
            note={rows.budgetTotal < HOME_ROW_MIN ? `auto · hidden (needs ${HOME_ROW_MIN})` : b.items.length ? 'auto' : 'tab hidden'}
            pinned={b.pinned}
            canReset
            products={b.items.slice(0, b.pinned ? 12 : 8)}
            store={{ kind: 'homeRows', key: b.key }}
            max={12}
            onOpen={onOpen}
            empty="No product in stock at this price."
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-[var(--fg-muted)]">
        Shop header: {place.shopHero.product ? place.shopHero.product.name : 'none'} {place.shopHeroSetting ? '' : '(auto)'}
      </p>
    </section>
  )
}
