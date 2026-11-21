import { lazy, Suspense, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { mainCategories } from '@/lib/categoryTree'
import { canonicalCategorySlug } from '@/lib/categorySlug'
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
import { HOME_ROW_MIN, SIGNATURE_MIN } from '@/components/home/HomeBlocks'

/** The "Complete your setup" editor (its own code, loaded when its tab is opened) */
const CompleteSetupAdmin = lazy(() => import('@/pages/admin/CompleteSetupAdmin').then((m) => ({ default: m.CompleteSetupAdmin })))
import { SETUP_ICON, SETUP_IDS, setupListAfter, type SetupPiece } from '@/lib/setups'
import { budgetLabel, setupLabel } from '@/components/admin/ProductAutoPlaces'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { en } from '@/i18n/en'
import { toast } from '@/store/toastStore'
import { useAdminT } from '@/store/adminLangStore'
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
  readOnly = false,
}: {
  product: Product
  index: number
  count: number
  busy: boolean
  onOpen: (p: Product) => void
  onMove: (from: number, to: number) => void
  onRemove: (id: string) => void
  /** A section that fills itself: only "edit the product" */
  readOnly?: boolean
}) {
  const navigate = useNavigate()
  const tr = useAdminT()
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
            <span className="absolute bottom-1 end-1 rounded bg-[var(--danger)] px-1 text-[9px] font-bold uppercase text-white">{tr('products.board.soldOut')}</span>
          ) : null}
        </span>
        <span className="block px-2 pt-1.5">
          <span className="block truncate text-xs font-medium group-hover:text-[var(--brand-text)]">{product.name}</span>
          <span className="block text-[11px] tabular-nums text-[var(--fg-muted)]">{formatCurrency(product.price)}</span>
        </span>
      </button>
      {/* Rank, edit, remove from this section */}
      {readOnly ? (
        <span className="mt-1 flex items-center justify-end border-t border-[var(--border)] px-0.5 py-0.5">
          <button type="button" className={iconBtn} title={tr('products.board.editProduct')} aria-label={tr('products.board.editProduct')} onClick={() => navigate(`/admin/products/${product._id}/edit`)}>
            <SiteIcon name="pencil" size={13} />
          </button>
        </span>
      ) : (
      <span className="mt-1 flex items-center justify-between border-t border-[var(--border)] px-0.5 py-0.5">
        <button type="button" className={iconBtn} title={tr('products.board.moveLeft')} aria-label={tr('products.board.moveLeft')} disabled={busy || index === 0} onClick={() => onMove(index, index - 1)}>
          <SiteIcon name="chevron-left" size={14} className="rtl:rotate-180" />
        </button>
        <button type="button" className={iconBtn} title={tr('products.board.moveRight')} aria-label={tr('products.board.moveRight')} disabled={busy || index === count - 1} onClick={() => onMove(index, index + 1)}>
          <SiteIcon name="chevron-right" size={14} className="rtl:rotate-180" />
        </button>
        <button type="button" className={iconBtn} title={tr('products.board.editProduct')} aria-label={tr('products.board.editProduct')} onClick={() => navigate(`/admin/products/${product._id}/edit`)}>
          <SiteIcon name="pencil" size={13} />
        </button>
        <button
          type="button"
          className={cn(iconBtn, 'hover:text-[var(--danger)]')}
          title={tr('products.board.removeTitle')}
          aria-label={tr('products.board.removeLabel')}
          disabled={busy}
          onClick={() => onRemove(product._id)}
        >
          <SiteIcon name="close" size={14} />
        </button>
      </span>
      )}
    </div>
  )
}

/**
 * A home section that fills itself (no choice to make here): the products customers see in it
 * now, and how it chooses them. Each product can still be opened / edited.
 */
function AutoSection({
  step,
  icon,
  title,
  how,
  products,
  onOpen,
  empty,
  children,
}: {
  step: number
  icon: SiteIconName
  title: string
  /** How it fills itself, in a few words */
  how: string
  products: Product[]
  onOpen: (p: Product) => void
  empty: string
  children?: React.ReactNode
}) {
  const tr = useAdminT()
  return (
    <div className="min-w-0 max-w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/15 p-2.5">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[10px] font-bold text-[var(--bg)]" title={tr('products.board.placeOnPage')}>
          {step}
        </span>
        <SiteIcon name={icon} size={14} className="shrink-0 text-[var(--brand-text)]" />
        <p className="truncate text-[13px] font-semibold">{title}</p>
        <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)]">{products.length}</span>
        <StatusPill note={how} />
      </div>
      {children}
      <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
        {products.map((p, i) => (
          <Tile key={p._id} product={p} index={i} count={products.length} busy={false} onOpen={onOpen} onMove={() => undefined} onRemove={() => undefined} readOnly />
        ))}
      </div>
      {!products.length ? <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{empty}</p> : null}
    </div>
  )
}

/** Home categories, in the home page order (Home.tsx: HOME_CATEGORIES first, 6 tabs) */
const HOME_TAB_CATEGORIES = ['desktop-pcs', 'laptops', 'gaming-pcs', 'monitors']

/** "Browse by category": one tab per category, its products in stock (automatic) */
function CategoryTabsSection({ step, onOpen }: { step: number; onOpen: (p: Product) => void }) {
  const tr = useAdminT()
  const cats = useQuery({ queryKey: ['categories'], queryFn: async () => (await categoriesApi.list()).data.data })
  const list = mainCategories((cats.data ?? []).filter((c) => c.slug !== 'office' && c.slug !== 'networking'))
  const chosen = HOME_TAB_CATEGORIES.map((slug) => list.find((c) => canonicalCategorySlug(c.slug) === slug)).filter((c): c is (typeof list)[number] => Boolean(c))
  const tabs = [...chosen, ...list.filter((c) => !chosen.includes(c))].slice(0, 6)
  const [pick, setPick] = useState<string | null>(null)
  const active = tabs.find((c) => c._id === pick) ?? tabs[0]
  const products = useQuery({
    queryKey: ['products', 'home-category', active?.slug],
    queryFn: async () => (await productsApi.list({ category: active!.slug, inStock: true, limit: 12 })).data.data,
    enabled: Boolean(active),
  })
  return (
    <AutoSection step={step} icon="layers" title={tr('products.board.browse')} how={tr('products.board.howCat')} products={products.data ?? []} onOpen={onOpen} empty={tr('products.board.emptyCat')}>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tabs.map((c) => (
          <button
            key={c._id}
            type="button"
            onClick={() => setPick(c._id)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition',
              c._id === active?._id ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]' : 'border-[var(--border)] hover:border-[var(--brand)]'
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
    </AutoSection>
  )
}

/** "your choice" / "auto" / a note; `warn` = the section is hidden on the page (shown in orange) */
function StatusPill({ pinned, note, warn }: { pinned?: boolean; note?: string; warn?: boolean }) {
  const tr = useAdminT()
  const text = pinned ? tr('products.board.yourChoice') : (note ?? tr('products.board.auto'))
  const hidden = !pinned && Boolean(warn)
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
  noteWarn,
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
  /** The note says the section is hidden on the page */
  noteWarn?: boolean
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
  const tr = useAdminT()
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
      toast.success(store.kind === 'setup' ? tr('products.board.setupsUpdated') : tr('products.auto.homeUpdated'))
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
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[10px] font-bold text-[var(--bg)]" title={tr('products.board.placeOnPage')}>
            {step}
          </span>
        ) : null}
        <SiteIcon name={icon} size={14} className="shrink-0 text-[var(--brand-text)]" />
        <p className="truncate text-[13px] font-semibold">{title}</p>
        <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)]">{products.length}</span>
        {!bare ? <StatusPill pinned={pinned} note={note} warn={noteWarn} /> : null}
        {pinned && canReset ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => save.mutate({ next: [], reset: true })}
            className="text-[10px] font-medium text-[var(--brand-text)] hover:underline disabled:opacity-50"
          >
            {tr('products.board.backAuto')}
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
          title={full ? tr('products.board.fullTitle', { max }) : tr('products.board.addTitle')}
          className="flex min-h-[8.5rem] w-[8.75rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border)] text-xs font-medium text-[var(--brand-text)] transition hover:border-[var(--brand)] hover:bg-[color-mix(in_srgb,var(--brand)_6%,transparent)] disabled:opacity-40"
        >
          <SiteIcon name="plus" size={18} />
          {full ? tr('products.board.full', { max }) : tr('products.add')}
        </button>
      </div>
      {!products.length ? <p className="mt-1 text-[11px] text-[var(--fg-muted)]">{empty}</p> : null}
      <Modal open={adding} onClose={() => setAdding(false)} title={tr('products.board.addTo', { name: title })} size="md">
        <ProductSearch
          currentId=""
          chosenIds={store.kind === 'setup' ? store.all : ids}
          actionLabel={tr('products.add')}
          saving={busy || full}
          onSelect={(id) => save.mutate({ next: [...ids, id] }, { onSuccess: () => setAdding(false) })}
        />
      </Modal>
    </div>
  )
}

/** The home page exactly as customers see it, section by section, top to bottom. */
function HomeBoard({ onOpen }: { onOpen: (p: Product) => void }) {
  const tr = useAdminT()
  const place = useStorefrontPlacements()
  const rows = useHomeRows([...place.deals.products, ...place.featuredList, ...place.row])

  // Our selection → Best sellers (same request as the home page)
  const best = useQuery({
    queryKey: ['products', 'home-best'],
    queryFn: async () => (await productsApi.list({ sort: 'popular', inStock: true, limit: 10 })).data.data,
  })
  // Our brands: the brands of the products on the home page (3 at least)
  const pageProducts = [...place.deals.products, ...place.featuredList, ...place.row, ...rows.deals, ...rows.newArrivals, ...rows.budgets.flatMap((b) => b.items)]
  const brandNames = [...new Set(pageProducts.map((p) => (typeof p.brand === 'object' && p.brand ? p.brand.name : '')).filter(Boolean))].slice(0, 12)

  if (!place.ready || !rows.ready) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    )
  }

  // Deals of the moment hides with fewer than HOME_ROW_MIN products; the selection tabs show from 1
  const auto = tr('products.board.auto')
  const rowNote = (n: number) => (n < HOME_ROW_MIN ? tr('products.board.hiddenNeeds', { count: HOME_ROW_MIN }) : auto)
  const tabNote = (n: number) => (n ? auto : tr('products.board.tabHidden'))

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {/* In the order of the home page, top to bottom (Home.tsx) */}
        <Section
          step={1}
          icon="tag"
          title={tr('products.board.dealsBanner')}
          pinned={place.pinnedDeals.length > 0}
          canReset
          products={place.deals.products}
          store={{ kind: 'homeDeals' }}
          max={MAX_HOME_DEALS}
          onOpen={onOpen}
          empty={tr('products.board.noDeals')}
        />
        <Section
          step={2}
          icon="tag"
          title={tr('products.dealsMoment')}
          note={rowNote(rows.deals.length)}
          noteWarn={rows.deals.length < HOME_ROW_MIN}
          pinned={rows.dealsPinned}
          canReset
          products={rows.deals}
          store={{ kind: 'homeRows', key: 'deals' }}
          max={12}
          onOpen={onOpen}
          empty={tr('products.board.noDealsYet')}
        />
        <Section
          step={3}
          icon="star"
          title={tr('products.board.topFirst')}
          note={tr('products.board.yourChoice')}
          products={place.featuredList}
          store={{ kind: 'flag', flag: 'isFeatured' }}
          max={HOME_FEATURED_LIMIT}
          onOpen={onOpen}
          empty={tr('products.board.noFeatured')}
        />
        <Section
          step={3}
          icon="layers"
          title={tr('products.board.topThen')}
          note={place.rowFromCarousel ? tr('products.board.yourChoice') : auto}
          products={place.rowFromCarousel ? place.row : []}
          store={{ kind: 'flag', flag: 'isCarousel' }}
          max={HOME_ROW_LIMIT}
          onOpen={onOpen}
          empty={tr('products.board.emptyThen')}
        />
        <Section
          step={3}
          icon="clock"
          title={tr('products.board.newArrivals')}
          note={tabNote(rows.newArrivals.length)}
          noteWarn={!rows.newArrivals.length}
          pinned={rows.newPinned}
          canReset
          products={rows.newArrivals}
          store={{ kind: 'homeRows', key: 'new' }}
          max={12}
          onOpen={onOpen}
          empty={tr('products.board.nothingNew')}
        />
        <AutoSection
          step={3}
          icon="package-check"
          title={tr('products.board.best')}
          how={tr('products.board.howBest')}
          products={best.data ?? []}
          onOpen={onOpen}
          empty={tr('products.board.nothingSold')}
        />
        <Section
          step={4}
          icon="star"
          title={tr('products.signature')}
          note={rows.signature.length < SIGNATURE_MIN ? tr('products.board.hiddenNeeds', { count: SIGNATURE_MIN }) : tr('products.board.autoBrynoxa')}
          noteWarn={rows.signature.length < SIGNATURE_MIN}
          pinned={rows.signaturePinned}
          canReset
          products={rows.signature}
          store={{ kind: 'homeRows', key: 'signature' }}
          max={12}
          onOpen={onOpen}
          empty={tr('products.board.noBrynoxa')}
        />
        <CategoryTabsSection step={5} onOpen={onOpen} />
        {rows.budgets.map((b) => (
          <Section
            key={b.id}
            step={6}
            icon="banknote"
            title={tr('products.board.budget', { band: budgetLabel(b) })}
            note={b.items.length ? auto : tr('products.board.cardHidden')}
            noteWarn={!b.items.length}
            pinned={b.pinned}
            canReset
            products={b.items.slice(0, b.pinned ? 12 : 6)}
            store={{ kind: 'homeRows', key: b.key }}
            max={12}
            onOpen={onOpen}
            empty={tr('products.board.noAtPrice')}
          />
        ))}
        <div className="min-w-0 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-muted)]/15 p-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--fg)] text-[10px] font-bold text-[var(--bg)]" title={tr('products.board.placeOnPage')}>
              9
            </span>
            <SiteIcon name="tag" size={14} className="shrink-0 text-[var(--brand-text)]" />
            <p className="truncate text-[13px] font-semibold">{tr('products.board.brands')}</p>
            <StatusPill note={brandNames.length < 3 ? tr('products.board.hiddenNeeds', { count: 3 }) : tr('products.board.autoBrands')} warn={brandNames.length < 3} />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {brandNames.map((n) => (
              <span key={n} className="rounded-full border border-[var(--border)] px-2.5 py-1 text-[11px] font-semibold uppercase">
                {n}
              </span>
            ))}
          </div>
        </div>
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
  const tr = useAdminT()
  const [adding, setAdding] = useState(false)
  const key = setupRowKey(list.id)
  const all = list.items.map((p) => p._id)
  const save = useMutation({
    mutationFn: (next: string[]) => adminApi.settings.update({ homeRows: { [key]: next.slice(0, MAX_SETUP_ROW) } }),
    onSuccess: () => {
      for (const k of [['products'], ['settings'], ['admin-settings']]) qc.invalidateQueries({ queryKey: k })
      toast.success(tr('products.board.setupsUpdated'))
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
        <p className="text-sm font-semibold">{setupLabel(list.id)}</p>
        <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)]">{list.items.length}</span>
        <StatusPill pinned={list.pinned} note={tr('products.board.auto')} />
        {list.pinned ? (
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate([])}
            className="text-[10px] font-medium text-[var(--brand-text)] hover:underline disabled:opacity-50"
          >
            {tr('products.board.backAuto')}
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
            <SiteIcon name="plus" size={12} /> {tr('products.add')}
          </button>
          <a href={`/setups/${list.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--brand-text)] hover:underline">
            {tr('products.board.view')} <SiteIcon name="external" size={11} />
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
        <p className="mt-2 text-[11px] text-[var(--fg-muted)]">{tr('products.noProducts')}</p>
      )}
      <Modal open={adding} onClose={() => setAdding(false)} title={tr('products.board.addTo', { name: setupLabel(list.id) })} size="md">
        <p className="mb-3 text-xs text-[var(--fg-muted)]">{tr('products.board.groupHint')}</p>
        <ProductSearch
          currentId=""
          chosenIds={all}
          actionLabel={tr('products.add')}
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

type BoardTab = 'home' | 'setups' | 'setup'
const BOARD_TABS: BoardTab[] = ['home', 'setups', 'setup']
const TAB_KEY = 'brynoxa-admin-board-tab'

/**
 * The shop pages exactly as customers see them, one tab per page: the Home page (Hero, Featured
 * (first in Top picks), Carousel, Deals, New arrivals, Shop by budget, plus the Shop page header)
 * and "Pick your setup" (the home "Grab your setup" button: one card per setup, one row per
 * group). Each product shows its rank and can be moved, edited or removed; "+ Add" adds one.
 * Automatic sections become "your choice" once changed.
 */
export function HomeLayoutBoard({ onOpen }: { onManage?: unknown; onOpen: (p: Product) => void }) {
  const [params] = useSearchParams()
  const tr = useAdminT()
  const [tab, setTab] = useState<BoardTab>(() => {
    // A link asking for a tab (?board=setup) wins over the last one used
    const asked = params.get('board') as BoardTab | null
    if (asked && BOARD_TABS.includes(asked)) return asked
    try {
      const saved = localStorage.getItem(TAB_KEY) as BoardTab | null
      return saved && BOARD_TABS.includes(saved) ? saved : 'home'
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
    { id: 'home', label: tr('products.homePage'), icon: 'home', href: '/' },
    { id: 'setups', label: tr('products.board.setupsPage'), icon: 'layers', href: '/setups' },
    { id: 'setup', label: tr('products.board.completeSetup'), icon: 'plus', href: '/shop' },
  ]
  const current = tabs.find((x) => x.id === tab)!

  return (
    <section className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label={tr('products.board.shopPages')} className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
          {tabs.map((x) => (
            <button
              key={x.id}
              type="button"
              role="tab"
              aria-selected={tab === x.id}
              onClick={() => pick(x.id)}
              className={cn(
                // Real buttons: the open one filled in the brand colour
                'inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                tab === x.id
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow'
                  : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
              )}
            >
              <SiteIcon name={x.icon} size={15} />
              <span className="truncate">{x.label}</span>
            </button>
          ))}
        </div>
        {/* Complete your setup is per product: nothing single to view */}
        {tab !== 'setup' ? (
          <a href={current.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--brand-text)] hover:underline">
            {tr('products.board.view')} <SiteIcon name="external" size={11} />
          </a>
        ) : null}
      </div>
      {tab === 'home' ? (
        <HomeBoard onOpen={onOpen} />
      ) : tab === 'setups' ? (
        <SetupsBoard onOpen={onOpen} />
      ) : (
        <Suspense fallback={<div className="flex justify-center py-6"><Spinner /></div>}>
          <CompleteSetupAdmin embedded />
        </Suspense>
      )}
    </section>
  )
}
