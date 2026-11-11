import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { Modal } from '@/components/ui/Modal'
import { ProductSearch } from '@/components/admin/PageHeaderProducts'
import { HERO_NONE, SHOP_ALL, useHeroProduct, type HeroCategory, type HeroSource } from '@/hooks/useHeroProduct'
import { childrenOf, mainCategories } from '@/lib/categoryTree'
import { categoryPhoto } from '@/lib/categoryPhoto'
import { onePerCategory } from '@/lib/heroProduct'
import { settingsApi } from '@/api/settingsApi'
import { productsApi } from '@/api/productsApi'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { Category, Product } from '@/types'

/** What each row's header shows, in plain words */
const SOURCE_TEXT: Record<HeroSource, string> = {
  category: 'Your choice',
  main: 'From main category',
  'from-category': 'Auto',
  page: 'Shop header',
  'empty-category': 'Category photo',
  auto: 'Auto',
  none: 'Photo only',
}

const btn =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 text-xs font-medium transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] disabled:pointer-events-none disabled:opacity-40'

function Thumb({ product, photo, small = false }: { product: Product | null; photo?: string; small?: boolean }) {
  const image = product?.images?.find((i) => i.isPrimary)?.url || product?.images?.[0]?.url || photo
  return (
    <span className={cn('relative block shrink-0 overflow-hidden rounded-lg border border-[var(--border)]', small ? 'h-12 w-16' : 'h-16 w-24', imageFit(image) === 'contain' ? 'bg-white' : 'bg-[var(--bg-muted)]')}>
      {image ? (
        <SafeImage
          src={sizedImageUrl(image, 240)}
          alt=""
          referrerPolicy="no-referrer"
          className={cn('h-full w-full', imageFit(image) === 'contain' ? 'object-contain p-1 mix-blend-multiply' : 'object-cover')}
        />
      ) : (
        <span className="grid h-full place-items-center text-[var(--fg-muted)]">
          <SiteIcon name="monitor" size={18} />
        </span>
      )}
    </span>
  )
}

/**
 * One line: a category (or the shop without a category) and the product its header shows now,
 * with Change / Photo only / Automatic.
 */
function HeaderRow({
  title,
  depth = 0,
  category,
  setting,
  save,
  busy,
  photo,
  allView = false,
  rotation = [],
}: {
  /** The "All" line: the products shown in turn there */
  rotation?: Product[]
  /** The shop's "All" line: no product = the category photos */
  allView?: boolean
  /** The category photo, shown when no product is */
  photo?: string
  title: string
  depth?: 0 | 1
  /** undefined = the shop page with no category chosen */
  category?: HeroCategory
  /** What is saved for this line: '' automatic, a product id, or HERO_NONE */
  setting: string
  save: (value: string) => Promise<unknown>
  busy: boolean
}) {
  const navigate = useNavigate()
  const shown = useHeroProduct('shop', category)
  const [picking, setPicking] = useState(false)
  const status = shown.pending ? '…' : category ? SOURCE_TEXT[shown.source] : shown.product ? 'Your choice' : 'Rotates'
  const yours = Boolean(setting)

  return (
    <div className={cn('rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/25 p-2.5 sm:flex sm:items-center sm:gap-3', depth === 1 && 'ms-4 border-dashed sm:ms-6')}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {allView && !shown.product && rotation.length ? (
          // The products that take turns, overlapping
          <span className="flex shrink-0 -space-x-3 rtl:space-x-reverse">
            {rotation.slice(0, 3).map((p) => (
              <Thumb key={p._id} small product={p} />
            ))}
          </span>
        ) : (
          <Thumb small product={shown.product} photo={photo} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold">{title}</p>
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px]">
            <span
              className={cn(
                'shrink-0 rounded-full border px-1.5 font-semibold leading-4',
                yours ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] text-[var(--brand-text)]' : 'border-[var(--border)] text-[var(--fg-muted)]'
              )}
            >
              {status}
            </span>
            {shown.product ? (
              <button
                type="button"
                className="min-w-0 truncate text-[var(--fg-muted)] hover:text-[var(--brand-text)] hover:underline"
                onClick={() => navigate(`/admin/products/${shown.product!._id}/edit`)}
                title={`${shown.product.name} · ${formatCurrency(shown.product.price)}`}
              >
                {shown.product.name}
              </button>
            ) : null}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:mt-0 sm:shrink-0">
        <button type="button" className={btn} disabled={busy} onClick={() => setPicking(true)}>
          <SiteIcon name="pencil" size={12} /> {yours && setting !== HERO_NONE ? 'Change' : 'Choose'}
        </button>
        {allView ? null : (
          <button type="button" className={btn} disabled={busy || setting === HERO_NONE} onClick={() => save(HERO_NONE)} title="Show the photo, no product">
            <SiteIcon name="close" size={12} /> Photo
          </button>
        )}
        <button type="button" className={btn} disabled={busy || !yours} onClick={() => save('')} title="Pick one by itself">
          <SiteIcon name="refresh" size={12} /> Auto
        </button>
      </div>
      <Modal open={picking} onClose={() => setPicking(false)} title={`Header product · ${title}`} size="md">
        <ProductSearch
          currentId={setting !== HERO_NONE ? setting : ''}
          actionLabel="Use this"
          saving={busy}
          onSelect={(id) => save(id).then(() => setPicking(false))}
        />
      </Modal>
    </div>
  )
}

/** A main category and (on demand) its sub-categories. */
function MainBlock({
  main,
  subs,
  heroes,
  saveFor,
  busy,
  all,
}: {
  all: Category[]
  main: Category
  subs: Category[]
  heroes: Record<string, string>
  saveFor: (slug: string) => (value: string) => Promise<unknown>
  busy: boolean
}) {
  const [open, setOpen] = useState(() => subs.some((s) => heroes[s.slug]))
  return (
    <div className="space-y-1.5">
      <HeaderRow title={main.name} photo={categoryPhoto(main, all)} category={{ slug: main.slug, main: main.slug }} setting={heroes[main.slug] ?? ''} save={saveFor(main.slug)} busy={busy} />
      {subs.length ? (
        <button type="button" onClick={() => setOpen((v) => !v)} className="ms-6 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--brand-text)] hover:underline">
          <SiteIcon name={open ? 'chevron-down' : 'chevron-right'} size={12} className={open ? '' : 'rtl:rotate-180'} />
          {open ? 'Hide' : 'Show'} its {subs.length} sub-categories
        </button>
      ) : null}
      {open
        ? subs.map((s) => (
            <HeaderRow key={s._id} depth={1} title={s.name} photo={categoryPhoto(s, all)} category={{ slug: s.slug, main: main.slug }} setting={heroes[s.slug] ?? ''} save={saveFor(s.slug)} busy={busy} />
          ))
        : null}
    </div>
  )
}

/**
 * The product at the top of the Shop page, per category: Desktop PC shows a desktop, Laptops a
 * laptop… Nothing chosen = one of the category's own products (featured first); a sub-category
 * uses its main category's choice unless it has its own. Saved in Settings → categoryHeroes
 * (the shop without a category, "All": categoryHeroes.all — the category photos by default).
 */
export function ShopHeaderBoard() {
  const qc = useQueryClient()
  // The shop's own settings (the same ones the shop reads), not the owner-only admin copy
  const settings = useQuery({ queryKey: ['settings'], queryFn: async () => (await settingsApi.get()).data.data, staleTime: 60_000 })
  // What "All" shows in turn: the same pick as the shop page
  const allPicks = useQuery({
    queryKey: ['products', 'shop-all-hero'],
    queryFn: async () => (await productsApi.list({ inStock: true, sort: 'popular', limit: 60 })).data.data,
    staleTime: 5 * 60_000,
  })
  const categories = useQuery({ queryKey: ['categories'], queryFn: async () => (await categoriesApi.list()).data.data })
  const save = useMutation({
    mutationFn: (payload: { categoryHeroes?: Record<string, string>; pageHeroProducts?: { shop: string } }) => adminApi.settings.update(payload),
    onSuccess: () => {
      for (const k of [['settings'], ['admin-settings'], ['hero-product'], ['hero-category-products'], ['hero-auto-products']]) qc.invalidateQueries({ queryKey: k })
      toast.success('Shop page header updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (settings.isPending || categories.isPending) {
    return (
      <div className="flex justify-center py-6">
        <Spinner />
      </div>
    )
  }
  const heroes = (settings.data as { categoryHeroes?: Record<string, string> } | undefined)?.categoryHeroes ?? {}
  const list = (categories.data ?? []).filter((c) => c.slug !== 'office' && c.slug !== 'networking')
  const mains = mainCategories(list)
  const saveFor = (slug: string) => (value: string) => save.mutateAsync({ categoryHeroes: { [slug]: value } })
  const shopSetting = heroes[SHOP_ALL] ?? ''

  return (
    <>
      <div className="flex flex-col gap-2.5">
        <HeaderRow title="All products" allView rotation={onePerCategory(allPicks.data ?? [], list)} setting={shopSetting} save={saveFor(SHOP_ALL)} busy={save.isPending} />
        {mains.map((m) => (
          <MainBlock key={m._id} all={list} main={m} subs={childrenOf(list, m._id)} heroes={heroes} saveFor={saveFor} busy={save.isPending} />
        ))}
      </div>
    </>
  )
}
