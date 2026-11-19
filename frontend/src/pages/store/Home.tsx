import { LoadingImage } from '@/components/ui/ImageLoader'
import { Link, useNavigate } from 'react-router-dom'
import { useHomeDeals } from '@/hooks/useHomeDeals'
import { HomeHeroSlider, HomeHeroSliderSkeleton } from '@/components/home/HomeHeroSlider'
import { HomeTrustBar } from '@/components/home/HomeTrustBar'
import { HomeProductRow } from '@/components/home/HomeProductRow'
import { HomeBudget } from '@/components/home/HomeBudget'
import { HomeSignature } from '@/components/home/HomeSignature'
import { HomeSetups } from '@/components/home/HomeSetups'
import { useHomeRows } from '@/hooks/useHomeRows'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { Container } from '@/components/ui/Container'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { categoryIcon } from '@/lib/categoryIcon'
import { mainCategories } from '@/lib/categoryTree'
import { canonicalCategorySlug } from '@/lib/categorySlug'
import { categoryPhoto, categoryPhotoCredit, categoryPhotoPosition, categoryPhotoSrcSet } from '@/lib/categoryPhoto'
import { imageSrcSet, sizedImageUrl } from '@/lib/image'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { organizationData } from '@/lib/structuredData'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayName } from '@/i18n'
import type { Product } from '@/types'

/** The Brynoxa card's photo (a desk lit in teal; free Pexels photo). public/preload.js starts it early. */
export const HERO_PHOTO =
  'https://images.pexels.com/photos/6942359/pexels-photo-6942359.jpeg?auto=compress&cs=tinysrgb&w=1200&h=676&fit=crop'

/** Categories on the home page (by address), in this order first: Desktop PC, Laptops, Gaming PCs, Monitors */
const HOME_CATEGORIES = ['desktop-pcs', 'laptops', 'gaming-pcs', 'monitors']
/** Then other main categories with products, up to this many tiles in all */
const HOME_CATEGORY_MAX = 6

export function Home() {
  const navigate = useNavigate()
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)

  // Admin → Products → Home page deals (up to 4; automatic: best in-stock featured deals)
  const deals = useHomeDeals()
  const showDeals = deals.products.length > 0 || deals.pending

  const featured = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => (await productsApi.list({ featured: true, limit: 4 })).data.data,
  })

  const carousel = useQuery({
    queryKey: ['products', 'carousel'],
    queryFn: async () => (await productsApi.list({ carousel: true, limit: 12 })).data.data,
  })

  // Deals, New arrivals, Shop by budget: automatic, the same as Admin → Products shows
  const rows = useHomeRows([...deals.products, ...(featured.data ?? []), ...(carousel.data ?? [])])

  // Top picks: the featured products first, then the carousel ones (each once)
  const topPicks = [...(featured.data ?? []), ...(carousel.data ?? [])].filter(
    (p, i, all): p is Product => all.findIndex((q) => q._id === p._id) === i
  )

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  useSeo({
    title: t('meta.homeTitle'),
    description: t('meta.homeDescription'),
    path: '/',
    image: HERO_PHOTO,
    jsonLd: organizationData(),
  })

  // Main categories only (Components, not RAM / Storage, which are inside it)
  const categoryList = mainCategories(
    (categories.data ?? []).filter((c) => c.slug !== 'office' && c.slug !== 'networking')
  )
  // The chosen four first, then the other main categories (the shop only lists categories that
  // have products, so an empty one is never shown); "See more categories" opens the shop
  const chosen = HOME_CATEGORIES.map((slug) => categoryList.find((c) => canonicalCategorySlug(c.slug) === slug)).filter(
    (c): c is (typeof categoryList)[number] => Boolean(c)
  )
  const homeCategories = [...chosen, ...categoryList.filter((c) => !c.parent && !chosen.includes(c))].slice(0, HOME_CATEGORY_MAX)

  return (
    <>
      {/* Header: the deals banner, and beside it (under it on phones) the Brynoxa card with the headline */}
      <section aria-labelledby="home-hero-heading" className="pt-2 sm:pt-4">
        <Container>
          <div className={cn('grid gap-3 sm:gap-4 lg:gap-5', showDeals && 'lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[minmax(0,1fr)_24rem]')}>
            {showDeals ? (
              <div data-rise style={{ animationDelay: '0ms' }} className="min-w-0 lg:min-h-[31rem]">
                {deals.products.length ? <HomeHeroSlider products={deals.products} /> : <HomeHeroSliderSkeleton />}
              </div>
            ) : null}

            <div
              data-rise
              style={{ animationDelay: '80ms' }}
              className="relative isolate flex min-h-[15rem] flex-col justify-end overflow-hidden rounded-[1.5rem] border border-[rgb(0_194_255/0.22)] bg-[#05080b] p-4 text-white sm:min-h-[20rem] sm:rounded-[2rem] sm:p-8"
            >
              <img
                src={HERO_PHOTO}
                alt=""
                width={1200}
                height={676}
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 -z-20 h-full w-full object-cover object-[30%_50%]"
              />
              <div
                className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(5_8_11/0.15)_0%,rgb(5_8_11/0.55)_45%,rgb(5_8_11/0.96)_100%)]"
                aria-hidden="true"
              />
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-[rgb(0_194_255/0.4)] bg-[rgb(5_8_11/0.6)] px-3 py-1 text-xs font-semibold text-[var(--brand)] backdrop-blur sm:text-sm">
                <span className="size-2 rounded-full bg-[var(--brand)] shadow-[0_0_0_4px_rgb(0_194_255/0.22)]" />
                {t('home.kicker')}
              </p>
              <h1
                id="home-hero-heading"
                className="mt-3 font-display text-[1.6rem] font-bold leading-[1.1] tracking-tight text-balance [text-shadow:0_2px_18px_rgb(0_0_0/0.55)] sm:mt-4 sm:text-4xl lg:text-[2.35rem]"
              >
                {t('home.heroTitleLead')}
                <span className="block w-fit bg-gradient-to-r from-[#00c2ff] via-[#38d2ff] to-[#9be8ff] bg-clip-text text-transparent [text-shadow:none]">
                  {t('home.heroTitleAccent')}
                </span>
              </h1>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/75 sm:mt-3 sm:text-base">{t('home.heroBody')}</p>
              <div className="mt-4 flex flex-wrap gap-2 sm:mt-6">
                <Link
                  to="/setups"
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-12 sm:px-6 sm:text-base"
                >
                  {t('home.heroCtaShop')}
                  <SiteIcon name="arrow-right" size={15} className="rtl:rotate-180" />
                </Link>
                <a
                  href="#categories"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/25 bg-white/[0.06] px-4 text-sm font-semibold text-white backdrop-blur transition hover:border-[var(--brand)] hover:text-[var(--brand)] sm:h-12 sm:px-5 sm:text-base"
                >
                  {t('home.heroCtaBrowse')}
                </a>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* Cash on delivery, delivery, returns, WhatsApp */}
      <HomeTrustBar />

      {/* Categories: square tiles with a photo (a row you swipe on phones), "See more" opens the shop */}
      <section id="categories" aria-labelledby="home-categories-heading" className="scroll-mt-24 py-5 sm:py-8">
        <Container>
          <div className="mb-3 flex items-end justify-between gap-3 sm:mb-5">
            <div className="min-w-0">
              <h2 id="home-categories-heading" className="font-display text-lg font-bold tracking-tight sm:text-3xl">
                {t('home.categoriesTitle')}
              </h2>
              <p className="mt-1 hidden text-sm text-[var(--fg-muted)] sm:block">{t('home.categoriesBody')}</p>
            </div>
            <Link
              to="/shop"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--brand-text)] hover:underline sm:text-sm"
            >
              {t('home.seeMoreCategories')}
              <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
            </Link>
          </div>

          {categories.isError ? (
            <EmptyState
              title={t('home.categoriesErrorTitle')}
              description={t('home.categoriesErrorBody')}
              actionLabel={t('common.retry')}
              onAction={() => categories.refetch()}
            />
          ) : (
            <ul className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] [&::-webkit-scrollbar]:hidden">
              {categories.isLoading
                ? Array.from({ length: HOME_CATEGORY_MAX }).map((_, i) => (
                    <li key={i} className="w-[40vw] shrink-0 snap-start sm:w-auto">
                      <Skeleton className="aspect-[4/5] rounded-[1.25rem]" />
                    </li>
                  ))
                : homeCategories.map((c, i) => {
                    const photo = categoryPhoto(c)
                    const icon = categoryIcon(c.slug, c.name)
                    const name = categoryDisplayName(locale, c.slug, c.name)
                    return (
                      // Rise in with CSS: visible at once, never waiting for the animation code
                      <li
                        key={c._id}
                        className="w-[40vw] max-w-[11rem] shrink-0 snap-start sm:w-auto sm:max-w-none"
                        data-rise="card"
                        style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                      >
                        <Link
                          to={`/category/${c.slug}`}
                          className="group flex h-full flex-col overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft transition duration-300 hover:-translate-y-1 hover:border-[var(--brand)] hover:shadow-[0_18px_40px_-22px_rgb(0_194_255/0.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                        >
                          <div className="relative aspect-square overflow-hidden bg-[var(--bg-muted)]">
                            {photo ? (
                              <LoadingImage
                                src={c.image ? sizedImageUrl(photo, 480) : photo}
                                srcSet={categoryPhotoSrcSet(c) ?? (imageSrcSet(c.image, [480, 960]) || undefined)}
                                alt=""
                                width={480}
                                height={480}
                                sizes="(min-width: 1024px) 16vw, (min-width: 640px) 30vw, 40vw"
                                frameClassName="absolute inset-0"
                                style={{ objectPosition: categoryPhotoPosition(c) }}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
                                loading="lazy"
                              />
                            ) : null}
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/45 to-transparent" aria-hidden="true" />
                            <span className="absolute start-2 top-2 grid size-8 place-items-center rounded-full bg-[rgb(5_8_11/0.65)] text-[var(--brand)] backdrop-blur sm:start-3 sm:top-3 sm:size-9">
                              <SiteIcon name={icon} size={16} />
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 px-2.5 py-2.5 sm:px-3.5 sm:py-3">
                            <h3 className="truncate font-display text-[13px] font-semibold tracking-tight text-[var(--fg)] sm:text-base">{name}</h3>
                            <SiteIcon
                              name="arrow-right"
                              size={15}
                              className="text-[var(--fg-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-text)] rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                            />
                          </div>
                        </Link>
                      </li>
                    )
                  })}
            </ul>
          )}
          {/* Photo credits asked by the licence of some built-in photos (CC BY-SA) */}
          {homeCategories.some((c) => categoryPhotoCredit(c)) ? (
            <p className="mt-3 text-[11px] text-[var(--fg-muted)]" dir="ltr">
              {homeCategories
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

      {/* The four setups: another way to the Grab your setup page */}
      <HomeSetups />

      {/* Featured */}
      {featured.isError || carousel.isError ? (
        <Container className="py-6">
          <EmptyState
            icon="package-open"
            title={t('home.featuredErrorTitle')}
            description={t('home.featuredErrorBody')}
            actionLabel={t('common.retry')}
            onAction={() => {
              featured.refetch()
              carousel.refetch()
            }}
          />
        </Container>
      ) : featured.isPending || carousel.isPending ? (
        // First load only: background refetches keep the cards (and their loaded photos) on screen
        <Container className="py-3 sm:py-6">
          <div className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-5" role="status" aria-live="polite" aria-busy="true">
            <Skeleton className="h-28 rounded-[1.25rem] lg:h-auto lg:rounded-[1.75rem]" />
            <div className="flex gap-4 overflow-hidden" aria-hidden="true">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton spinner key={i} className="h-80 w-[min(14rem,62vw)] shrink-0 rounded-[1.35rem] sm:w-[17.5rem]" />
              ))}
            </div>
            <span className="sr-only">{t('ui.loadingProducts')}</span>
          </div>
        </Container>
      ) : !topPicks.length ? (
        <Container className="py-6">
          <EmptyState
            title={t('home.featuredEmptyTitle')}
            description={t('home.featuredEmptyBody')}
            actionLabel={t('home.browseShop')}
            onAction={() => navigate('/shop')}
          />
        </Container>
      ) : (
        <HomeProductRow
          id="featured"
          tone="featured"
          icon="star"
          kicker=""
          title={t('home.featuredTitle')}
          body={t('home.featuredBody')}
          viewAll={{ to: '/shop', label: t('common.viewAll') }}
          products={topPicks}
          min={1}
        />
      )}

      {/* Brynoxa Signature: products with the Brynoxa touch, between the top picks and the budgets */}
      <HomeSignature products={rows.signature} />

      {/* Products by budget: right after the top picks (price is how most people start) */}
      <HomeBudget budgets={rows.budgets} total={rows.budgetTotal} />
      <HomeProductRow
        id="deals"
        tone="deals"
        icon="tag"
        kicker={t('home.dealsKicker')}
        title={t('home.dealsTitle')}
        body={t('home.dealsBody')}
        viewAll={{ to: '/shop?onSale=true', label: t('home.seeAllDeals') }}
        products={rows.deals}
      />

      <HomeProductRow
        id="new-arrivals"
        tone="new"
        icon="clock"
        kicker={t('home.newKicker')}
        title={t('home.newTitle')}
        body={t('home.newBody')}
        viewAll={{ to: '/shop?sort=newest', label: t('common.viewAll') }}
        products={rows.newArrivals}
      />
    </>
  )
}
