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
import { MAX_SETUP_ROW, setupRowKey, useSetupLists, type SetupList } from '@/hooks/useSetupLists'
import { HOME_ROW_MIN } from '@/components/home/HomeProductRow'
import { ShopHeaderBoard } from '@/components/admin/ShopHeaderBoard'
import { SETUP_ADMIN_LABEL, SETUP_ICON, SETUP_IDS, setupListAfter, type SetupPiece } from '@/lib/setups'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { en } from '@/i18n/en'
import { toast } from '@/store/toastStore'
import type { Product } from '@/types'

/**
 * How a section is saved: Settings lists (Hero, Deals, New, budget tabs), product flags
 * (Featured, Carousel), or one group of a setup (the setup's whole list is saved: `all`).
 */
type Store =
  | { kind: 'homeDeals' }
  | { kind: 'homeRows'; key: HomeRowKey }
  | { kind: 'flag'; flag: 'isFeatured' | 'isCarousel' }
  | { kind: 'setup'; key: ReturnType<typeof setupRowKey>; all: string[] }

const iconBtn =
  'inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--fg)] disabled:pointer-events-none disabled:opacity-30'

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
    <div className="flex w-[8.75rem] shrink-0 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] transition hover:border-[var(--brand)]">
      <button type="button" onClick={() => onOpen(product)} title={product.name} className="group text-start">
        <span className={cn('relative block h-20 w-full overflow-hidden', imageFit(image) === 'contain' ? 'bg-white' : 'bg-[var(--bg-muted)]')}>
          {image ? (
            <SafeImage
              src={sizedImageUrl(image, 280)}
              alt=""
              referrerPolicy="no-referrer"
              className={cn('h-full w-full', imageFit(image) === 'contain' ? 'object-contain p-1 mix-blend-multiply' : 'object-cover')}
            />
          ) : null}
          <span className="absolute start-1 top-1 rounded-md bg-[var(--brand)] px-1.5 text-[11px] font-bold leading-5 text-[var(--brand-fg)] shadow">#{index + 1}</span>
          {product.stock <= 0 ? (
            <span className="absolute bottom-1 end-1 rounded bg-[var(--danger)] px-1 text-[9px] font-bold uppercase text-white">Sold out</span>
          ) : null}
        </span>
        <span className="block px-2 pt-1.5">
          <span className="block truncate text-xs font-medium group-hover:text-[var(--brand-text)]">{product.name}</span>
          <span className="block text-[11px] tabular-nums text-[var(--fg-muted)]">{formatCurrency(product.price)}</span>
        </span>
      </button>
      {/* Rank, edit, remove from this section */}
      <span className="mt-1 flex items-center justify-between border-t border-[var(--border)] px-0.5 py-0.5">
        <button type="button" className={iconBtn} title="Move left" aria-label="Move left" disabled={busy || index === 0} onClick={() => onMove(index, index - 1)}>
          <SiteIcon name="chevron-left" size={14} />
        </button>
        <button type="button" className={iconBtn} title="Move right" aria-label="Move right" disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)}>
          <SiteIcon name="chevron-right" size={14} />
        </button>
        <button type="button" className={iconBtn} title="Edit the product" aria-label="Edit the product" onClick={() => navigate(`/admin/products/${product._id}/edit`)}>
          <SiteIcon name="pencil" size={13} />
        </button>
        <button
          type="button"
          className={cn(iconBtn, 'hover:text-[var(--danger)]')}
          title="Remove from this section (the product stays in the shop)"
          aria-label="Remove from this section"
          disabled={busy}
          onClick={() => onRemove(product._id)}
        >
          <SiteIcon name="close" size={14} />
        </button>
      </span>
    </div>
  )
}

function StatusPill({ pinned, note }: { pinned?: boolean; note?: string }) {
  const text = pinned ? 'your choice' : (note ?? 'auto')
  const hidden = /hidden/.test(text)
  return (
    <span
      className={cn(
        'rounded-full border px-2 text-[10px] font-semibold leading-[1.15rem]',
        pinned
          ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]'
          : hidden
            ? 'border-[color-mix(in_srgb,var(--warning,#f59e0b)_50%,var(--border))] text-[var(--warning,#f59e0b)]'
            : 'border-[var(--border)] text-[var(--fg-muted)]'
      )}
    >
      {text}
    </span>
  )
}

/** One section: its products in order, with rank / edit / remove on each and "+ Add" at the end. */
function Section({
  step,
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
  bare,
}: {
  /** Place on the page (1 = top) */
  step?: number
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
  /** Inside a setup card: no card of its own, no status */
  bare?: boolean
}) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const ids = products.map((p) => p._id)

  const save = useMutation({
    mutationFn: async ({ next, removed, reset }: { next: string[]; removed?: string; reset?: boolean }) => {
      if (store.kind === 'homeDeals') return adminApi.settings.update({ homeDeals: next.slice(0, max) })
      if (store.kind === 'homeRows') return adminApi.settings.update({ homeRows: { [store.key]: next.slice(0, max) } })
      if (store.kind === 'setup') {
        const list = reset ? [] : setupListAfter(store.all, ids, next).slice(0, MAX_SETUP_ROW)
        return adminApi.settings.update({ homeRows: { [store.key]: list } })
      }
      // Featured / Carousel follow the time each product was (re)added: re-add from last to first
      if (removed) await adminApi.products.update(removed, { [store.flag]: false })
      for (const id of [...next].reverse()) await adminApi.products.update(id, { [store.flag]: true })
    },
    onSuccess: () => {
      for (const key of [['admin-products'], ['products'], ['settings'], ['admin-settings'], ['home-deals'], ['home-deals-auto'], ['hero-product'], ['hero-auto-products']]) {
        qc.invalidateQueries({ queryKey: key })
      }
      toast.success(store.kind === 'setup' ? 'Setups page updated' : 'Home page updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const busy = save.isPending
  const full = store.kind === 'setup' ? store.all.length >= MAX_SETUP_ROW : ids.length >= max

  const move = (from: number, to: number) => {
    const next = [...ids]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    save.mutate({ next })
  }

  return (
    <div className={cn('min-w-0 max-w-full', !bare && 'rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/25 p-2.5')}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {step ? (
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[10px] font-bold text-[var(--bg)]" title="Place on the page">
            {step}
          </span>
        ) : null}
        <SiteIcon name={icon} size={14} className="shrink-0 text-[var(--brand-text)]" />
        <p className="truncate text-[13px] font-semibold">{title}</p>
        <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)]">{products.length}</span>
        {!bare ? <StatusPill pinned={pinned} note={note} /> : null}
        {pinned && canReset ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => save.mutate({ next: [], reset: true })}
            className="text-[10px] font-medium text-[var(--brand-text)] hover:underline disabled:opacity-50"
          >
            Back to automatic
          </button>
        ) : null}
        {busy ? <Spinner size="sm" /> : null}
      </div>
      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
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
          className="flex min-h-[8.5rem] w-[8.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] text-xs font-medium text-[var(--brand-text)] transition hover:border-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)] disabled:opacity-40"
        >
          <SiteIcon name="plus" size={18} />
          {full ? `Full (${max})` : 'Add'}
        </button>
      </div>
      {!products.length ? <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{empty}</p> : null}
      <Modal open={adding} onClose={() => setAdding(false)} title={`Add to ${title}`} size="md">
        <ProductSearch
          currentId=""
          chosenIds={store.kind === 'setup' ? store.all : ids}
          actionLabel="Add"
          saving={busy || full}
          onSelect={(id) => save.mutate({ next: [...ids, id] }, { onSuccess: () => setAdding(false) })}
        />
      </Modal>
    </div>
  )
}

/** The home page exactly as customers see it, section by section, top to bottom. */
function HomeBoard({ onOpen }: { onOpen: (p: Product) => void }) {
  const place = useStorefrontPlacements()
  const rows = useHomeRows([...place.deals.products, ...place.featuredList, ...place.row])

  if (!place.ready || !rows.ready) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    )
  }

  // The home page hides a row with fewer than 4 products: say so here
  const rowNote = (n: number) => (n < HOME_ROW_MIN ? `hidden (needs ${HOME_ROW_MIN})` : 'auto')
  const amount = (n: number) => new Intl.NumberFormat('en-US').format(n)
  const bandTitle = (b: { min?: number; max?: number }) =>
    b.min === undefined ? `Under ${amount(b.max!)} DH` : b.max === undefined ? `Over ${amount(b.min)} DH` : `${amount(b.min)} – ${amount(b.max)} DH`

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <Section
          step={1}
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
          step={2}
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
          step={3}
          icon="layers"
          title="Carousel"
          note={place.rowFromCarousel ? 'your choice' : 'auto'}
          products={place.rowFromCarousel ? place.row : []}
          store={{ kind: 'flag', flag: 'isCarousel' }}
          max={HOME_ROW_LIMIT}
          onOpen={onOpen}
          empty="Empty: shows the next featured products."
        />
        {rows.budgets.map((b) => (
          <Section
            key={b.id}
            step={4}
            icon="banknote"
            title={`Budget · ${bandTitle(b)}`}
            note={rows.budgetTotal < HOME_ROW_MIN ? `hidden (needs ${HOME_ROW_MIN})` : b.items.length ? 'auto' : 'hidden'}
            pinned={b.pinned}
            canReset
            products={b.items.slice(0, b.pinned ? 12 : 6)}
            store={{ kind: 'homeRows', key: b.key }}
            max={12}
            onOpen={onOpen}
            empty="No product at this price."
          />
        ))}
        <Section
          step={5}
          icon="tag"
          title="Deals"
          note={rowNote(rows.deals.length)}
          pinned={rows.dealsPinned}
          canReset
          products={rows.deals}
          store={{ kind: 'homeRows', key: 'deals' }}
          max={12}
          onOpen={onOpen}
          empty="No deals yet."
        />
        <Section
          step={6}
          icon="clock"
          title="New arrivals"
          note={rowNote(rows.newArrivals.length)}
          pinned={rows.newPinned}
          canReset
          products={rows.newArrivals}
          store={{ kind: 'homeRows', key: 'new' }}
          max={12}
          onOpen={onOpen}
          empty="Nothing new yet."
        />
      </div>
    </>
  )
}

const PIECE_ICON: Record<SetupPiece, SiteIconName> = {
  pc: 'cpu',
  laptop: 'laptop',
  screen: 'monitor',
  mouse: 'mouse',
  keyboard: 'keyboard',
  headset: 'headphones',
  webcam: 'camera',
  camera: 'camera',
  components: 'boxes',
  accessories: 'cable',
}

/** One setup of the "Pick your setup" page: its groups as customers see them. */
function SetupCard({ list, onOpen }: { list: SetupList; onOpen: (p: Product) => void }) {
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const key = setupRowKey(list.id)
  const all = list.items.map((p) => p._id)
  const save = useMutation({
    mutationFn: (next: string[]) => adminApi.settings.update({ homeRows: { [key]: next.slice(0, MAX_SETUP_ROW) } }),
    onSuccess: () => {
      for (const k of [['products'], ['settings'], ['admin-settings']]) qc.invalidateQueries({ queryKey: k })
      toast.success('Setups page updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const names = en.setups.groups[list.id]

  return (
    <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/25 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-[var(--brand)] text-[var(--brand-fg)]">
          <SiteIcon name={SETUP_ICON[list.id]} size={16} />
        </span>
        <p className="text-sm font-semibold">{SETUP_ADMIN_LABEL[list.id]}</p>
        <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)]">{list.items.length}</span>
        <StatusPill pinned={list.pinned} note="auto" />
        {list.pinned ? (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate([])}
            className="text-[10px] font-medium text-[var(--brand-text)] hover:underline disabled:opacity-50"
          >
            Back to automatic
          </button>
        ) : null}
        {save.isPending ? <Spinner size="sm" /> : null}
        <span className="ms-auto flex items-center gap-3">
          <button
            type="button"
            disabled={save.isPending || all.length >= MAX_SETUP_ROW}
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-text)] hover:underline disabled:opacity-40"
          >
            <SiteIcon name="plus" size={12} /> Add
          </button>
          <a href={`/setups/${list.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--brand-text)] hover:underline">
            View <SiteIcon name="external" size={11} />
          </a>
        </span>
      </div>
      {list.pending ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : list.groups.length ? (
        <div className="mt-3 flex flex-col gap-3 divide-y divide-[var(--border)] [&>*+*]:pt-3">
          {list.groups.map((g) => (
            <Section
              key={g.piece}
              bare
              icon={PIECE_ICON[g.piece]}
              title={names[g.piece]}
              products={g.items}
              store={{ kind: 'setup', key, all }}
              max={MAX_SETUP_ROW}
              onOpen={onOpen}
              empty=""
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-[var(--fg-muted)]">No products yet.</p>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title={`Add to ${SETUP_ADMIN_LABEL[list.id]}`} size="md">
        <p className="mb-3 text-xs text-[var(--fg-muted)]">The product goes into its group (Gaming mice, Laptops…) by its category.</p>
        <ProductSearch
          currentId=""
          chosenIds={all}
          actionLabel="Add"
          saving={save.isPending}
          onSelect={(id) => save.mutate([...all, id], { onSuccess: () => setAdding(false) })}
        />
      </Modal>
    </div>
  )
}

/** "Pick your setup" (the home "Grab your setup" button): one card per setup. */
function SetupsBoard({ onOpen }: { onOpen: (p: Product) => void }) {
  const lists = useSetupLists()
  return (
    <>
      <div className="flex flex-col gap-2.5">
        {SETUP_IDS.map((id) => (
          <SetupCard key={id} list={lists[id]} onOpen={onOpen} />
        ))}
      </div>
    </>
  )
}

type BoardTab = 'home' | 'setups' | 'shop'
const TAB_KEY = 'brynoxa-admin-board-tab'

/**
 * The shop pages exactly as customers see them, one tab per page: the Home page (Hero, Featured
 * (#1 is the big card), Carousel, Deals, New arrivals, Shop by budget, plus the Shop page header)
 * and "Pick your setup" (the home "Grab your setup" button: one card per setup, one row per
 * group). Each product shows its rank and can be moved, edited or removed; "+ Add" adds one.
 * Automatic sections become "your choice" once changed.
 */
export function HomeLayoutBoard({ onOpen }: { onManage?: unknown; onOpen: (p: Product) => void }) {
  const [tab, setTab] = useState<BoardTab>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY)
      return saved === 'setups' || saved === 'shop' ? saved : 'home'
    } catch {
      return 'home'
    }
  })
  const pick = (next: BoardTab) => {
    setTab(next)
    try {
      localStorage.setItem(TAB_KEY, next)
    } catch {
      /* private mode */
    }
  }
  const tabs: { id: BoardTab; label: string; icon: SiteIconName; href: string }[] = [
    { id: 'home', label: 'Home page', icon: 'home', href: '/' },
    { id: 'setups', label: 'Setups page', icon: 'layers', href: '/setups' },
    { id: 'shop', label: 'Shop header', icon: 'cart', href: '/shop' },
  ]
  const current = tabs.find((x) => x.id === tab)!

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Shop pages" className="flex flex-wrap gap-1 rounded-lg bg-[var(--bg-muted)] p-1">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => pick(x.id)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition',
                tab === x.id ? 'bg-[var(--bg-elevated)] text-[var(--fg)] shadow-sm' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              <SiteIcon name={x.icon} size={13} />
              {x.label}
            </button>
          ))}
        </div>
        <a href={current.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--brand-text)] hover:underline">
          View <SiteIcon name="external" size={11} />
        </a>
      </div>
      {tab === 'home' ? <HomeBoard onOpen={onOpen} /> : tab === 'setups' ? <SetupsBoard onOpen={onOpen} /> : <ShopHeaderBoard />}
    </section>
  )
}
