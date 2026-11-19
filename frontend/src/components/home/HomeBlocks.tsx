import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { Container } from '@/components/ui/Container'
import { LoadingImage } from '@/components/ui/ImageLoader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { SIGNATURE_BRAND } from '@/hooks/useHomeRows'
import { categoryIcon } from '@/lib/categoryIcon'
import { categoryPhoto, categoryPhotoCredit, categoryPhotoPosition, categoryPhotoSrcSet } from '@/lib/categoryPhoto'
import { imageSrcSet, sizedImageUrl } from '@/lib/image'
import { bestDiscount, ownBudgetAmount, type Budget } from '@/lib/homeRows'
import { SETUP_ICON, SETUP_IDS } from '@/lib/setups'
import { CONTACT } from '@/lib/site'
import { whatsappHref } from '@/lib/whatsapp'
import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'
import { categoryDisplayName, type MessageKey } from '@/i18n'
import { useLocaleStore } from '@/store/localeStore'
import type { Brand, Category, Product } from '@/types'
import { HomeGrid, HomeSectionHead, HomeShelf } from './HomeShelf'
import type { CardBadge } from './HomeShopCard'

/** Fewer than this and the Deals block stays hidden (the deals card fills the row, so 2 look full) */
export const HOME_ROW_MIN = 2
/** Fewer than this and the Signature products under the banner stay hidden */
export const SIGNATURE_MIN = 2

const panel = 'rounded-[1.5rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-[2rem] sm:p-6 lg:p-7'

/** A category photo (built-in or uploaded), sized for the place */
function CategoryPhoto({ category, sizes, className, frameClassName = 'absolute inset-0' }: { category: Category; sizes: string; className?: string; frameClassName?: string }) {
  const photo = categoryPhoto(category)
  if (!photo) return null
  return (
    <LoadingImage
      src={category.image ? sizedImageUrl(photo, 480) : photo}
      srcSet={categoryPhotoSrcSet(category) ?? (imageSrcSet(category.image, [480, 960]) || undefined)}
      alt=""
      width={480}
      height={480}
      sizes={sizes}
      frameClassName={frameClassName}
      style={{ objectPosition: categoryPhotoPosition(category) }}
      className={cn('h-full w-full object-cover transition duration-500 group-hover:scale-[1.08]', className)}
      loading="lazy"
    />
  )
}

/* ------------------------------------------------------------------------------------------ */

/**
 * The page title (centred, like the big shops' "PC GAMER MAROC") and the categories as round
 * photos — a row you swipe on phones.
 */
export function HomeIntro({ categories, loading, error, onRetry }: { categories: Category[]; loading: boolean; error: boolean; onRetry: () => void }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  return (
    <section id="categories" aria-labelledby="home-hero-heading" className="scroll-mt-24 pb-2 pt-6 text-center sm:pb-4 sm:pt-10">
      <Container>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand)] sm:text-xs">{t('home.kicker')}</p>
        <h1 id="home-hero-heading" className="mx-auto mt-2 max-w-3xl font-display text-[1.45rem] font-extrabold uppercase leading-[1.1] tracking-tight text-balance sm:text-4xl lg:text-[2.6rem]">
          {t('home.heroTitleLead')}{' '}
          <span className="bg-gradient-to-r from-[#00c2ff] via-[#38d2ff] to-[#9be8ff] bg-clip-text text-transparent">{t('home.heroTitleAccent')}</span>
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-[13px] text-[var(--fg-muted)] sm:mt-3 sm:text-base">{t('home.heroBody')}</p>

        {error ? (
          <div className="mt-6">
            <EmptyState title={t('home.categoriesErrorTitle')} description={t('home.categoriesErrorBody')} actionLabel={t('common.retry')} onAction={onRetry} />
          </div>
        ) : (
          <ul
            aria-label={t('home.categoriesTitle')}
            className="-mx-4 mt-5 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:mt-8 sm:flex-wrap sm:justify-center sm:gap-6 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <li key={i} className="shrink-0">
                    <Skeleton className="size-20 rounded-full sm:size-28" />
                  </li>
                ))
              : categories.map((c, i) => (
                  <li key={c._id} className="w-20 shrink-0 snap-start sm:w-28" data-rise="card" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                    <Link to={`/category/${c.slug}`} className="group flex flex-col items-center gap-2 focus-visible:outline-none">
                      <span className="relative block size-20 overflow-hidden rounded-full border-2 border-[var(--border)] bg-[var(--bg-muted)] shadow-soft transition duration-300 group-hover:border-[var(--brand)] group-hover:shadow-[0_0_0_4px_rgb(0_194_255/0.18)] group-focus-visible:border-[var(--brand)] sm:size-28">
                        <CategoryPhoto category={c} sizes="(min-width: 640px) 7rem, 5rem" />
                        <span className="absolute bottom-1 end-1 grid size-6 place-items-center rounded-full bg-[rgb(5_8_11/0.75)] text-[var(--brand)] sm:size-7">
                          <SiteIcon name={categoryIcon(c.slug, c.name)} size={13} />
                        </span>
                      </span>
                      <span className="line-clamp-2 text-[11.5px] font-bold leading-tight text-[var(--fg)] group-hover:text-[var(--brand-text)] sm:text-sm">
                        {categoryDisplayName(locale, c.slug, c.name)}
                      </span>
                    </Link>
                  </li>
                ))}
          </ul>
        )}
        {/* Photo credits asked by the licence of some photos (CC BY-SA) */}
        {categories.some((c) => categoryPhotoCredit(c)) ? (
          <p className="mt-2 text-[11px] text-[var(--fg-muted)]" dir="ltr">
            {categories
              .filter((c) => categoryPhotoCredit(c))
              .map((c) => {
                const cr = categoryPhotoCredit(c)!
                return (
                  <span key={c._id} className="me-3">
                    {categoryDisplayName(locale, c.slug, c.name)}:{' '}
                    <a href={cr.source} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                      {cr.author}
                    </a>
                    ,{' '}
                    <a href={cr.licenceUrl} target="_blank" rel="noopener noreferrer license" className="underline-offset-2 hover:underline">
                      {cr.licence}
                    </a>
                    {cr.edited ? ' (edited)' : ''}
                  </span>
                )
              })}
          </p>
        ) : null}
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

/**
 * "Deals of the moment": a dark promo card ("Up to −14%", how many deals, the button) first in the
 * row, then the deal cards you scroll sideways.
 */
export function HomeDealsBlock({ products }: { products: Product[] }) {
  const t = useT()
  if (products.length < HOME_ROW_MIN) return null
  const off = bestDiscount(products)
  // The biggest real saving in DH (old price − price)
  const saved = Math.max(0, ...products.map((p) => (p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice - p.price : 0)))
  const lead = (
    <Link
      to="/shop?onSale=true"
      className="group relative isolate flex h-full min-h-[16rem] flex-col justify-between overflow-hidden rounded-2xl border border-[rgb(0_194_255/0.45)] bg-[#05080b] p-4 text-white sm:p-5"
    >
      <span className="absolute inset-0 -z-10 bg-[radial-gradient(90%_60%_at_0%_0%,rgb(0_194_255/0.45),transparent_65%),radial-gradient(80%_60%_at_100%_100%,rgb(0_194_255/0.22),transparent_60%)]" aria-hidden="true" />
      <SiteIcon name="tag" size={130} className="absolute -bottom-6 -end-6 -z-10 rotate-[-14deg] text-[rgb(0_194_255/0.12)]" />
      <span className="inline-flex w-fit items-center gap-1.5 rounded-md bg-[var(--brand)] px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-fg)] sm:text-[11px]">
        <SiteIcon name="tag" size={12} />
        {t('home.dealsKicker')}
      </span>
      <span>
        {off > 0 ? (
          <span className="block font-display text-3xl font-black leading-none tracking-tight text-[var(--brand)] sm:text-5xl">{t('home.upTo', { percent: off })}</span>
        ) : null}
        <span className="mt-2 block font-display text-base font-extrabold uppercase leading-tight sm:text-xl">{t('home.dealsTitle')}</span>
        <span className="mt-1 block text-[11.5px] text-white/65 sm:text-[13px]">{t('home.dealsCount', { count: products.length })}</span>
        {saved > 0 ? (
          <span className="mt-2 inline-flex rounded-md bg-[rgb(0_194_255/0.16)] px-2 py-0.5 text-[11px] font-bold text-[#9be8ff] sm:text-xs">{t('home.dealsSaveUpTo', { amount: formatCurrency(saved) })}</span>
        ) : null}
      </span>
      <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-[#05080b] transition group-hover:bg-[var(--brand)] sm:text-sm">
        {t('home.seeAllDeals')}
        <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
      </span>
    </Link>
  )
  return (
    <section id="deals" data-reveal="" aria-labelledby="home-deals-heading" className="scroll-mt-24 py-3 sm:py-5">
      <Container>
        <div className={cn(panel, 'border-[rgb(0_194_255/0.3)]')}>
          <HomeSectionHead id="home-deals-heading" title={t('home.dealsMomentTitle')} body={t('home.dealsBody')} viewAll={{ to: '/shop?onSale=true', label: t('home.seeAllDeals') }} />
          <HomeShelf products={products} lead={lead} badge={() => 'deal'} label={t('home.dealsMomentTitle')} />
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

type TabId = 'picks' | 'new' | 'best'

/**
 * "Our selection" with three tabs — Top picks, New arrivals, Best sellers — and a grid of cards
 * (up to two rows), like the shops' "Nos sélections / Nouvel arrivage / Meilleures ventes".
 */
export function HomeSelection({
  picks,
  newArrivals,
  pending,
  error,
  onRetry,
}: {
  picks: Product[]
  newArrivals: Product[]
  pending: boolean
  error: boolean
  onRetry: () => void
}) {
  const t = useT()
  const [tab, setTab] = useState<TabId>('picks')
  const best = useQuery({
    queryKey: ['products', 'home-best'],
    queryFn: async () => (await productsApi.list({ sort: 'popular', inStock: true, limit: 10 })).data.data,
    enabled: tab === 'best',
    staleTime: 60_000,
  })
  const tabs: { id: TabId; label: string; icon: SiteIconName; to: string; items: Product[]; badge: (p: Product) => CardBadge }[] = [
    { id: 'picks', label: t('home.tabPicks'), icon: 'star', to: '/shop', items: picks, badge: () => null },
    { id: 'new', label: t('home.tabNew'), icon: 'clock', to: '/shop?sort=newest', items: newArrivals, badge: () => 'new' },
    { id: 'best', label: t('home.tabBest'), icon: 'package-check', to: '/shop?sort=popular', items: best.data ?? [], badge: () => 'top' },
  ]
  const shown = tabs.filter((x) => x.id === 'best' || x.items.length > 0)
  const active = shown.find((x) => x.id === tab) ?? shown[0]
  const loading = active.id === 'best' ? best.isPending : pending

  return (
    <section id="featured" data-reveal="" aria-labelledby="home-featured-heading" className="scroll-mt-24 py-3 sm:py-5">
      <Container>
        <div className={panel}>
          <div className="mb-3 flex flex-col gap-3 sm:mb-5 lg:flex-row lg:items-center lg:justify-between">
            <HomeSectionHead id="home-featured-heading" title={t('home.selectionTitle')} className="mb-0 sm:mb-0" />
            <div role="tablist" aria-label={t('home.selectionTitle')} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none] sm:gap-2 [&::-webkit-scrollbar]:hidden">
              {shown.map((x) => (
                <button
                  key={x.id}
                  type="button"
                  role="tab"
                  aria-selected={x.id === active.id}
                  onClick={() => setTab(x.id)}
                  className={cn(
                    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-[12.5px] font-bold uppercase tracking-wide transition sm:h-11 sm:px-4 sm:text-sm',
                    x.id === active.id
                      ? 'bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow'
                      : 'border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
                  )}
                >
                  <SiteIcon name={x.icon} size={15} />
                  {x.label}
                  {x.id !== 'best' && x.items.length ? (
                    <span className={cn('rounded-full px-1.5 text-[10px] leading-4', x.id === active.id ? 'bg-black/20' : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]')}>{x.items.length}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <div role="tabpanel" aria-label={active.label}>
            {error && active.id !== 'best' ? (
              <EmptyState icon="package-open" title={t('home.featuredErrorTitle')} description={t('home.featuredErrorBody')} actionLabel={t('common.retry')} onAction={onRetry} />
            ) : loading ? (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" role="status" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton spinner key={i} className={cn('aspect-[3/4.4] rounded-2xl', i > 1 && 'max-sm:hidden', i > 3 && 'max-xl:hidden')} />
                ))}
                <span className="sr-only">{t('ui.loadingProducts')}</span>
              </div>
            ) : active.items.length ? (
              <HomeGrid products={active.items.slice(0, 10)} badge={active.badge} />
            ) : (
              <p className="py-8 text-center text-sm text-[var(--fg-muted)]">{t('home.featuredEmptyBody')}</p>
            )}
          </div>
          <div className="mt-4 flex justify-center sm:mt-6">
            <Link
              to={active.to}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 text-sm font-bold text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              {t('common.viewAll')}
              <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

/** The teal desk photo of the Signature banner (free Pexels photo) */
export const SIGNATURE_PHOTO =
  'https://images.pexels.com/photos/6942359/pexels-photo-6942359.jpeg?auto=compress&cs=tinysrgb&w=1200&h=676&fit=crop'

/**
 * Brynoxa Signature: a wide cinematic banner (the teal desk photo, the B mark, the line and the
 * button), and the Signature products under it.
 */
export function HomeSignatureBanner({ products }: { products: Product[] }) {
  const t = useT()
  return (
    <section id="signature" data-reveal="" aria-labelledby="home-signature-heading" className="scroll-mt-24 py-3 sm:py-5">
      <Container>
        <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-[rgb(0_194_255/0.35)] bg-[#05080b] text-white shadow-[0_30px_80px_-40px_rgb(0_194_255/0.6)] sm:rounded-[2rem]">
          <img src={SIGNATURE_PHOTO} alt="" width={1200} height={676} loading="lazy" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover object-[70%_50%] opacity-80" />
          <span className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#05080b_0%,rgb(5_8_11/0.92)_38%,rgb(5_8_11/0.35)_75%,rgb(5_8_11/0.15)_100%)] rtl:bg-[linear-gradient(270deg,#05080b_0%,rgb(5_8_11/0.92)_38%,rgb(5_8_11/0.35)_75%,rgb(5_8_11/0.15)_100%)]" aria-hidden="true" />
          <div className="flex min-h-[14rem] flex-col justify-center p-5 sm:min-h-[19rem] sm:p-10 lg:p-12">
            <div className="flex items-center gap-3">
              <span className="inline-flex size-11 overflow-hidden rounded-xl ring-1 ring-[rgb(0_194_255/0.5)] shadow-[0_0_24px_-4px_rgb(0_194_255/0.8)] sm:size-14 sm:rounded-2xl">
                <img src="/brand/brynoxa-mark-128.webp" alt="" width={56} height={56} className="h-full w-full scale-[1.08] object-cover" decoding="async" />
              </span>
              <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--brand)] sm:text-xs">{t('home.signatureBadge')}</span>
            </div>
            <h2 id="home-signature-heading" className="mt-4 max-w-xl font-display text-2xl font-black uppercase leading-[1.05] tracking-tight sm:text-5xl">
              {t('home.signatureTitle')}
            </h2>
            <p className="mt-2 max-w-md text-[13px] text-white/75 sm:mt-3 sm:text-base">{t('home.signatureBody')}</p>
            <Link
              to={`/shop?brand=${SIGNATURE_BRAND}`}
              className="btn-shine mt-5 inline-flex h-11 w-fit items-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 sm:h-12 sm:px-7 sm:text-base"
            >
              {t('home.signatureViewAll')}
              <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
            </Link>
          </div>
        </div>
        {products.length >= SIGNATURE_MIN ? (
          <div className="mt-3 sm:mt-5">
            <HomeShelf products={products} label={t('home.signatureTitle')} />
          </div>
        ) : null}
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

/**
 * Products by category, with a tab per category (the shops' "Composants: Carte graphique /
 * Processeurs / …"): a photo card of the category first, then its products to scroll.
 */
export function HomeCategoryTabs({ categories }: { categories: Category[] }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const [chosen, setChosen] = useState<string | null>(null)
  const active = categories.find((c) => c._id === chosen) ?? categories[0]
  const products = useQuery({
    queryKey: ['products', 'home-category', active?.slug],
    queryFn: async () => (await productsApi.list({ category: active!.slug, inStock: true, limit: 12 })).data.data,
    enabled: Boolean(active),
    staleTime: 60_000,
  })
  if (!active || categories.length < 2) return null
  const name = categoryDisplayName(locale, active.slug, active.name)
  const lead = (
    <Link
      to={`/category/${active.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[rgb(0_194_255/0.3)] bg-[#05080b] text-white transition hover:border-[var(--brand)]"
    >
      {/* The photo in its own landscape frame (a wide photo is never squeezed into a tall card) */}
      <span className="relative block aspect-[4/3] overflow-hidden">
        <CategoryPhoto category={active} sizes="(min-width: 1024px) 18rem, 46vw" className="brightness-[0.85] saturate-[0.9]" />
        <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,#05080b)]" aria-hidden="true" />
      </span>
      <span className="flex flex-1 flex-col justify-end p-4 pt-1 sm:p-5 sm:pt-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--brand)] sm:text-[11px]">{t('home.categoriesKicker')}</span>
      <span className="mt-1 font-display text-lg font-black uppercase leading-tight sm:text-2xl">{name}</span>
      <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-bold text-[#05080b] transition group-hover:bg-[var(--brand)] sm:text-sm">
        {t('home.catSeeAll')}
        <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
      </span>
      </span>
    </Link>
  )
  return (
    <section id="by-category" data-reveal="" aria-labelledby="home-bycat-heading" className="scroll-mt-24 py-3 sm:py-5">
      <Container>
        <div className={panel}>
          <HomeSectionHead id="home-bycat-heading" title={t('home.catProductsTitle')} viewAll={{ to: '/shop', label: t('home.seeMoreCategories') }} />
          <div role="tablist" aria-label={t('home.catProductsTitle')} className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:mb-5 sm:gap-2 [&::-webkit-scrollbar]:hidden">
            {categories.map((c) => {
              const on = c._id === active._id
              return (
                <button
                  key={c._id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setChosen(c._id)}
                  className={cn(
                    'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-bold transition sm:h-12 sm:px-4 sm:text-sm',
                    on
                      ? 'border-[var(--brand)] bg-[rgb(0_194_255/0.12)] text-[var(--brand-text)] shadow-[inset_0_-3px_0_var(--brand)]'
                      : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--brand)]'
                  )}
                >
                  <SiteIcon name={categoryIcon(c.slug, c.name)} size={16} />
                  {categoryDisplayName(locale, c.slug, c.name)}
                </button>
              )
            })}
          </div>
          <div role="tabpanel" aria-label={name}>
            {products.isPending ? (
              <div className="flex gap-2.5 overflow-hidden sm:gap-4" role="status" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton spinner key={i} className="aspect-[3/4.4] w-[calc((100%-0.625rem)/2)] shrink-0 rounded-2xl sm:w-[calc((100%-2rem)/3)] lg:w-[calc((100%-3rem)/4)]" />
                ))}
              </div>
            ) : (
              <HomeShelf products={products.data ?? []} lead={lead} label={name} />
            )}
          </div>
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

const BAND_ICON: Record<string, SiteIconName> = { small: 'tag', mid: 'laptop', high: 'star' }
const BAND_NAME: Record<string, MessageKey> = { small: 'home.budgetSmallName', mid: 'home.budgetMidName', high: 'home.budgetHighName' }

/**
 * "Shop by budget": three big price cards (how many products, from what price) opening the shop
 * on that price range, and a fourth card to type one's own budget.
 */
export function HomeBudgetCards({ budgets }: { budgets: (Budget & { items: Product[] })[] }) {
  const t = useT()
  const navigate = useNavigate()
  const locale = useLocaleStore((s) => s.locale)
  const [draft, setDraft] = useState('')
  const amount = (n: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-MA' : 'en-US').format(n)
  const bands = budgets.filter((b) => b.items.length)
  if (!bands.length) return null
  const link = (min?: number, max?: number, sort = 'price_asc') =>
    `/shop?${new URLSearchParams({ ...(min ? { minPrice: String(min) } : {}), ...(max ? { maxPrice: String(max) } : {}), sort, inStock: 'true' })}`
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const own = ownBudgetAmount(draft)
    if (own !== null) navigate(link(undefined, own, 'price_desc'))
  }

  return (
    <section id="budget" data-reveal="" aria-labelledby="home-budget-heading" className="scroll-mt-24 py-3 sm:py-5">
      <Container>
        <HomeSectionHead id="home-budget-heading" title={t('home.budgetTitle')} body={t('home.budgetBody')} />
        <ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
          {bands.map((b) => {
            const from = Math.min(...b.items.map((p) => p.price))
            return (
              <li key={b.id}>
                <Link
                  to={link(b.min, b.max)}
                  className="group relative isolate flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 transition hover:-translate-y-0.5 hover:border-[var(--brand)] sm:p-5"
                >
                  <SiteIcon name={BAND_ICON[b.id] ?? 'banknote'} size={90} className="absolute -bottom-4 -end-4 -z-10 text-[rgb(0_194_255/0.07)]" />
                  <span className="grid size-10 place-items-center rounded-xl bg-[rgb(0_194_255/0.14)] text-[var(--brand-text)] transition group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)] sm:size-12">
                    <SiteIcon name={BAND_ICON[b.id] ?? 'banknote'} size={20} />
                  </span>
                  <span className="mt-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-[var(--fg-muted)] sm:text-xs">{t(BAND_NAME[b.id])}</span>
                  <span className="mt-0.5 font-display text-[15px] font-extrabold leading-tight text-[var(--fg)] sm:text-2xl">
                    {t(b.label, { min: amount(b.min ?? 0), max: amount(b.max ?? 0) })}
                  </span>
                  <span className="mt-1 text-[11px] text-[var(--fg-muted)] sm:text-sm">
                    {t('home.budgetCount', { count: b.items.length })} · {t('home.budgetFrom', { price: amount(from) })}
                  </span>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-text)] sm:text-sm">
                    {t('home.budgetSeeAll')}
                    <SiteIcon name="chevron-right" size={14} className="transition group-hover:translate-x-0.5 rtl:rotate-180" />
                  </span>
                </Link>
              </li>
            )
          })}
          <li className={cn(bands.length % 2 === 0 && 'col-span-2 lg:col-span-1')}>
            <form onSubmit={submit} className="flex h-full flex-col rounded-2xl border border-dashed border-[rgb(0_194_255/0.4)] bg-[rgb(0_194_255/0.05)] p-3.5 sm:p-5">
              <span className="grid size-10 place-items-center rounded-xl bg-[rgb(0_194_255/0.14)] text-[var(--brand-text)] sm:size-12">
                <SiteIcon name="sliders" size={20} />
              </span>
              <label htmlFor="home-own-budget" className="mt-3 font-display text-[15px] font-extrabold leading-tight sm:text-xl">
                {t('home.budgetOwnTitle')}
              </label>
              <div className="mt-auto flex gap-2 pt-3">
                <div className="relative min-w-0 flex-1">
                  <input
                    id="home-own-budget"
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={t('home.budgetOwnPlaceholder')}
                    className="h-10 w-full rounded-full border border-[var(--border)] bg-[var(--bg)] pe-10 ps-3.5 text-sm outline-none focus:border-[var(--brand)]"
                  />
                  <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-[var(--fg-muted)]">DH</span>
                </div>
                <button type="submit" className="h-10 shrink-0 rounded-full bg-[var(--brand)] px-4 text-sm font-bold text-[var(--brand-fg)] transition hover:brightness-110">
                  {t('home.budgetOwnShow')}
                </button>
              </div>
            </form>
          </li>
        </ul>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

/**
 * "Find your next setup": a dark band with the four setups as big buttons, each opening its page.
 */
export function HomeSetupsBand() {
  const t = useT()
  return (
    <section id="setups" data-reveal="" aria-labelledby="home-setups-heading" className="scroll-mt-24 py-3 sm:py-5">
      <Container>
        <div className="relative isolate overflow-hidden rounded-[1.5rem] border border-[rgb(0_194_255/0.3)] bg-[#05080b] p-4 text-white sm:rounded-[2rem] sm:p-8 lg:p-10">
          <span className="absolute inset-0 -z-10 bg-[radial-gradient(60%_90%_at_100%_0%,rgb(0_194_255/0.25),transparent_60%),radial-gradient(50%_80%_at_0%_100%,rgb(0_194_255/0.12),transparent_60%)]" aria-hidden="true" />
          <span
            className="absolute inset-0 -z-10 opacity-[0.06] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:40px_40px]"
            aria-hidden="true"
          />
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--brand)] sm:text-xs">Brynoxa · {t('common.setups')}</p>
          <h2 id="home-setups-heading" className="mt-1.5 font-display text-xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
            {t('home.setupsBandTitle')}
          </h2>
          <p className="mt-1.5 max-w-xl text-[13px] text-white/70 sm:text-base">{t('home.setupsBandBody')}</p>
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:mt-7 sm:gap-3 lg:grid-cols-4">
            {SETUP_IDS.map((id) => (
              <li key={id}>
                <Link
                  to={`/setups/${id}`}
                  className="group flex h-full items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] p-2.5 transition hover:border-[var(--brand)] hover:bg-[rgb(0_194_255/0.12)] sm:gap-3.5 sm:rounded-2xl sm:p-4"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[rgb(0_194_255/0.16)] text-[var(--brand)] transition group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)] sm:size-12 sm:rounded-xl">
                    <SiteIcon name={SETUP_ICON[id]} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-extrabold uppercase sm:text-base">{t(`setups.${id}.name`)}</span>
                    <span className="hidden truncate text-xs text-white/60 sm:block">{t(`setups.${id}.tagline`)}</span>
                  </span>
                  <SiteIcon name="chevron-right" size={16} className="ms-auto hidden text-white/50 group-hover:text-[var(--brand)] sm:block rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

/**
 * "Our brands": the brands of the products already on the page (so every brand shown has
 * something in stock), each opening the shop on that brand.
 */
export function HomeBrands({ products }: { products: Product[] }) {
  const t = useT()
  const seen = new Map<string, Brand>()
  for (const p of products) {
    const b = typeof p.brand === 'object' ? (p.brand as Brand) : null
    if (b?.slug && !seen.has(b.slug)) seen.set(b.slug, b)
  }
  const brands = [...seen.values()].slice(0, 12)
  if (brands.length < 3) return null
  return (
    <section data-reveal="" aria-labelledby="home-brands-heading" className="py-4 sm:py-8">
      <Container>
        <HomeSectionHead id="home-brands-heading" title={t('home.brandsTitle')} viewAll={{ to: '/shop', label: t('common.viewAll') }} />
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
          {brands.map((b) => (
            <li key={b.slug}>
              <Link
                to={`/shop?brand=${encodeURIComponent(b.slug)}`}
                className="flex h-14 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 transition hover:border-[var(--brand)] sm:h-20"
                title={b.name}
              >
                {b.logo ? (
                  <img src={sizedImageUrl(b.logo, 240)} alt={b.name} width={120} height={40} loading="lazy" className="max-h-7 w-auto max-w-full object-contain sm:max-h-9" />
                ) : (
                  <span className="truncate font-display text-sm font-extrabold uppercase tracking-wider text-[var(--fg-muted)] sm:text-lg">{b.name}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

/* ------------------------------------------------------------------------------------------ */

/**
 * "Not sure what to choose?": a band with WhatsApp (the question already written) and a call
 * button, like the shops' "Besoin d'aide ?". Numbers from Settings → Contact (read when shown).
 */
export function HomeHelpBand() {
  const t = useT()
  return (
    <section data-reveal="" aria-labelledby="home-help-heading" className="py-3 sm:py-5">
      <Container>
        <div className="relative isolate flex flex-col gap-4 overflow-hidden rounded-[1.5rem] border border-[rgb(0_194_255/0.3)] bg-[linear-gradient(110deg,rgb(0_194_255/0.16),rgb(0_194_255/0.04)_55%,transparent)] p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-[2rem] sm:p-8">
          <SiteIcon name="chat" size={160} className="absolute -bottom-10 end-24 -z-10 hidden rotate-[-10deg] text-[rgb(0_194_255/0.07)] lg:block" />
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow sm:size-14">
              <SiteIcon name="headphones" size={22} />
            </span>
            <div className="min-w-0">
              <h2 id="home-help-heading" className="font-display text-lg font-extrabold uppercase leading-tight tracking-tight sm:text-2xl">
                {t('home.helpBandTitle')}
              </h2>
              <p className="mt-1 max-w-lg text-[13px] text-[var(--fg-muted)] sm:text-[15px]">{t('home.helpBandBody')}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <a
              href={whatsappHref(t('home.helpBandMessage'))}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-shine inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 sm:flex-none sm:h-12 sm:px-6"
            >
              <SiteIcon name="chat" size={17} />
              {t('home.helpBandWhatsapp')}
            </a>
            <a
              href={CONTACT.phone.href}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-5 text-sm font-bold text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:flex-none sm:h-12"
            >
              <SiteIcon name="phone" size={16} />
              <span dir="ltr">{CONTACT.phone.value}</span>
            </a>
          </div>
        </div>
      </Container>
    </section>
  )
}
