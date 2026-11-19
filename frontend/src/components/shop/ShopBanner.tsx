import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useHeroProduct, type HeroCategory } from '@/hooks/useHeroProduct'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'

/** Time each product stays in the banner's product card */
export const BANNER_ROTATE_MS = 5000

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

/** The product card on the right of the banner (one at a time; ‹ › and a timer change it) */
function BannerProduct({ products }: { products: Product[] }) {
  const t = useT()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = products.length
  const p = products[index % count]
  useEffect(() => {
    if (count < 2 || paused) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % count), BANNER_ROTATE_MS)
    return () => window.clearTimeout(id)
  }, [index, count, paused])
  if (!p) return null
  const image = primaryImage(p)
  const contain = imageFit(image) === 'contain'
  const off = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0
  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Link
        key={p._id}
        to={`/product/${p.slug}`}
        data-rise="card"
        className="group flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.06] p-2.5 text-white backdrop-blur transition hover:border-[var(--brand)] sm:gap-4 sm:p-3"
      >
        <span className={cn('relative block size-20 shrink-0 overflow-hidden rounded-xl sm:size-28', contain ? 'photo-stage' : 'bg-white/10')}>
          {image ? (
            <SafeImage
              src={sizedImageUrl(image, 320)}
              alt=""
              width={112}
              height={112}
              referrerPolicy="no-referrer"
              className={cn('h-full w-full transition duration-500 group-hover:scale-105', contain ? 'object-contain p-2 mix-blend-multiply' : 'object-cover')}
            />
          ) : null}
          {off ? <span className="absolute start-1 top-1 rounded bg-[var(--brand)] px-1 text-[10px] font-extrabold text-[var(--brand-fg)]">-{off}%</span> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand)]">{t('product.featuredPick')}</span>
          <span className="mt-0.5 line-clamp-2 block text-[13px] font-bold uppercase leading-tight sm:text-sm">{p.name}</span>
          <span className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="font-display text-lg font-extrabold text-[var(--brand)] sm:text-xl">{formatCurrency(p.price)}</span>
            {off ? <span className="text-[11px] text-white/45 line-through">{formatCurrency(p.compareAtPrice!)}</span> : null}
          </span>
        </span>
        <SiteIcon name="chevron-right" size={18} className="shrink-0 text-white/50 transition group-hover:text-[var(--brand)] rtl:rotate-180" />
      </Link>
      {count > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5" role="group" aria-label={t('product.featuredPick')}>
          {products.map((x, i) => (
            <button
              key={x._id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={x.name}
              aria-current={i === index % count}
              className={cn('h-1.5 rounded-full transition-all', i === index % count ? 'w-6 bg-[var(--brand)]' : 'w-1.5 bg-white/30 hover:bg-white/60')}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Shop banner, like the big Moroccan shops' category pages: the path (Home › Shop › Laptops), a
 * dark banner with the category photo, the title in capitals, its description (folded after two
 * lines on phones), how many products, a search box, and on the right the product chosen in
 * Admin → Products → Shop page header (or one per category in turn on "All").
 */
export function ShopBanner({
  crumbs,
  title,
  description,
  count,
  photo,
  category,
  rotate,
  search,
  onSearch,
}: {
  crumbs: { label: string; to?: string }[]
  title: string
  description: string
  count: string
  photo: string
  category?: HeroCategory
  rotate?: Product[]
  search: string
  onSearch: (q: string) => void
}) {
  const t = useT()
  const hero = useHeroProduct('shop', category)
  const products = hero.product ? [hero.product] : (rotate ?? [])
  const [draft, setDraft] = useState(search)
  const [open, setOpen] = useState(false)
  useEffect(() => setDraft(search), [search])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    onSearch(draft.trim())
  }

  return (
    <div className="pt-2 sm:pt-4">
      <nav aria-label={t('shop.breadcrumb')} className="mb-2 sm:mb-3">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--fg-muted)] sm:text-[13px]">
          {crumbs.map((c, i) => (
            <li key={i} className="inline-flex items-center gap-1">
              {i > 0 ? <SiteIcon name="chevron-right" size={12} className="opacity-60 rtl:rotate-180" /> : null}
              {c.to ? (
                <Link to={c.to} className="hover:text-[var(--brand-text)]">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-semibold uppercase text-[var(--fg)]">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <section aria-labelledby="shop-heading" className="relative isolate overflow-hidden rounded-[1.5rem] border border-[rgb(0_194_255/0.28)] bg-[#05080b] text-white sm:rounded-[2rem]">
        <img src={photo} alt="" width={1600} height={600} fetchPriority="high" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover object-[60%_45%]" />
        <span className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgb(5_8_11/0.96)_0%,rgb(5_8_11/0.82)_38%,rgb(5_8_11/0.25)_75%,rgb(5_8_11/0.1)_100%)] rtl:bg-[linear-gradient(270deg,rgb(5_8_11/0.96)_0%,rgb(5_8_11/0.82)_38%,rgb(5_8_11/0.25)_75%,rgb(5_8_11/0.1)_100%)]" aria-hidden="true" />
        <span className="absolute inset-x-0 bottom-0 -z-10 h-1 bg-[linear-gradient(90deg,var(--brand),transparent)]" aria-hidden="true" />
        <div className="grid gap-5 p-4 sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-center lg:gap-10 lg:p-10">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand)] sm:text-xs">{count}</p>
            <h1 id="shop-heading" className="mt-1.5 font-display text-2xl font-black uppercase leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
              {title}
            </h1>
            {description ? (
              <div className="mt-2 max-w-2xl sm:mt-3">
                <p className={cn('text-[13px] leading-relaxed text-white/75 sm:text-[15px]', !open && 'line-clamp-2')}>{description}</p>
                {description.length > 120 ? (
                  <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--brand)] hover:underline">
                    {open ? t('shop.readLess') : t('shop.readMore')}
                  </button>
                ) : null}
              </div>
            ) : null}
            <form onSubmit={submit} className="mt-4 flex max-w-xl overflow-hidden rounded-xl border border-white/15 bg-white/[0.07] backdrop-blur focus-within:border-[var(--brand)] sm:mt-6">
              <label htmlFor="shop-search" className="sr-only">
                {t('shop.searchShop')}
              </label>
              <input
                id="shop-search"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('shop.searchShopPlaceholder')}
                className="h-11 min-w-0 flex-1 bg-transparent px-3.5 text-sm text-white outline-none placeholder:text-white/50 sm:h-12"
              />
              <button type="submit" aria-label={t('shop.searchAction')} className="grid w-12 shrink-0 place-items-center bg-[var(--brand)] text-[var(--brand-fg)] transition hover:brightness-110 sm:w-14">
                <SiteIcon name="search" size={18} />
              </button>
            </form>
          </div>
          {products.length ? <BannerProduct products={products} /> : null}
        </div>
      </section>
    </div>
  )
}
