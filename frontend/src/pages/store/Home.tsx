import { useSyncExternalStore } from 'react'
import { LoadingImage } from '@/components/ui/ImageLoader'
import { Link, useNavigate } from 'react-router-dom'
import { useHomeDeals } from '@/hooks/useHomeDeals'
import { HeroBackdrop } from '@/components/home/HeroBackdrop'
import { HomeDealsShowcase } from '@/components/home/HomeDeals'
import { HomeSpotlightSkeleton } from '@/components/home/HomeSpotlight'
import { HomeProductRow } from '@/components/home/HomeProductRow'
import { HomeBudget } from '@/components/home/HomeBudget'
import { useHomeRows } from '@/hooks/useHomeRows'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { Container } from '@/components/ui/Container'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { categoryIcon } from '@/lib/categoryIcon'
import { mainCategories } from '@/lib/categoryTree'
import { categoryPhoto, categoryPhotoCredit, categoryPhotoPosition, categoryPhotoSrcSet } from '@/lib/categoryPhoto'
import { imageSrcSet, sizedImageUrl } from '@/lib/image'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { organizationData } from '@/lib/structuredData'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayDescription, categoryDisplayName } from '@/i18n'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=2560&q=85'

/**
 * Bento of categories: the first two are big; the rest fill rows of three (two on tablets). The
 * last tile stretches over what is left of its row, so the grid never ends with an empty gap.
 */
function categoryTileClass(index: number, count: number) {
  if (index === 0) return 'min-h-[18rem] sm:col-span-2 lg:col-span-2 lg:row-span-2 lg:min-h-[24rem]'
  if (index === 1) return cn('min-h-[18rem] lg:row-span-2 lg:min-h-[24rem]', count === 2 && 'sm:col-span-2 lg:col-span-1')
  const last = index === count - 1
  const lgLeft = (count - 2) % 3 // tiles on the last desktop row (0 = full)
  const smOdd = (count - 1) % 2 === 1 // tablets: tile 0 takes a row, the rest go two by two
  return cn('min-h-[12.5rem]', last && smOdd && 'sm:col-span-2', last && lgLeft === 1 && 'lg:col-span-3', last && lgLeft === 2 && 'lg:col-span-2', last && smOdd && lgLeft === 0 && 'lg:col-span-1')
}

function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
    () => false
  )
}

const TRUST = [
  { key: 'home.heroPerkCod', icon: 'banknote' },
  { key: 'home.heroPerkDelivery', icon: 'truck' },
  { key: 'home.heroPerkWarranty', icon: 'shield' },
  { key: 'home.heroPerkReturns', icon: 'refresh' },
] as const

export function Home() {
  const navigate = useNavigate()
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)

  // Admin → Settings → Home page deals (up to 4; automatic: best in-stock featured deals)
  const deals = useHomeDeals()
  const showDeals = deals.products.length > 0 || deals.pending
  // One showcase only (beside the headline on desktop, under it on phones)
  const isDesktop = useMediaQuery('(min-width: 1024px)')

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

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  useSeo({
    title: t('meta.homeTitle'),
    description: t('meta.homeDescription'),
    path: '/',
    image: HERO_IMAGE,
    jsonLd: organizationData(),
  })

  // Main categories only (Components, not RAM / Storage, which are inside it)
  const categoryList = mainCategories(
    (categories.data ?? []).filter((c) => c.slug !== 'office' && c.slug !== 'networking')
  )

  return (
    <>
      {/* The header follows the theme, with its own photo for each (HeroBackdrop); a rounded card with a small gap around it */}
      <section
        aria-labelledby="home-hero-heading"
        className="relative mx-2 -mt-[calc(var(--nav-height)-0.5rem)] flex flex-col overflow-hidden rounded-[2rem] bg-[var(--bg)] text-[var(--fg)] sm:mx-3 sm:-mt-[calc(var(--nav-height)-0.75rem)] sm:min-h-[calc(100svh-0.75rem)] sm:rounded-[3rem]"
      >
        <HeroBackdrop />

        <Container className="relative z-10 grid flex-1 items-center [align-content:safe_center] gap-8 pb-7 pt-[calc(var(--nav-height)+4.25rem)] sm:pb-10 sm:pt-[calc(var(--nav-height)+1.75rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] xl:gap-14">
          {/* Phones: headline → deals → buttons → trust chips. Tablet / desktop: normal order */}
          <div className="flex min-w-0 flex-col sm:block">
          {/* Hidden on phones (wrapper: .kicker sets its own display) */}
          <div data-rise style={{ animationDelay: '0ms' }} className="max-sm:hidden">
            <p className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--brand)_35%,transparent)] bg-[color-mix(in_srgb,var(--brand)_10%,var(--bg-elevated))] px-3.5 py-1.5 font-display text-sm font-semibold text-[var(--brand-text)] shadow-soft dark:bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] dark:text-[var(--brand)]">
              <span className="size-2 rounded-full bg-[var(--brand)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_22%,transparent)]" />
              {t('home.kicker')}
            </p>
          </div>

          <h1
            id="home-hero-heading"
            data-rise style={{ animationDelay: '80ms' }}
            className="order-1 max-w-2xl font-display text-[1.5rem] font-bold leading-[1.15] tracking-tight hero-title dark:[text-shadow:0_2px_18px_rgb(0_0_0/0.55)] sm:mt-5 sm:leading-snug text-balance text-[var(--fg)] sm:text-4xl md:text-[2.75rem] xl:text-5xl lg:[text-shadow:none] dark:text-white"
          >
            {t('home.heroTitleLead')}
            <span className="hero-accent block w-fit bg-gradient-to-r [text-shadow:none] from-[#0077b6] via-[#0096d6] to-[#00b4ef] bg-clip-text text-transparent dark:from-[#00c2ff] dark:via-[#38d2ff] dark:to-[#9be8ff]">
              {t('home.heroTitleAccent')}
            </span>
          </h1>

          <p
            data-rise style={{ animationDelay: '160ms' }}
            className="mt-3 max-w-lg text-[13px] font-medium leading-relaxed text-[var(--fg)]/75 max-sm:hidden sm:mt-5 sm:text-lg dark:text-white/85"
          >
            {t('home.heroBody')}
          </p>

          <div
            data-rise style={{ animationDelay: '240ms' }}
            className="order-3 mt-3 flex flex-wrap items-center gap-2 sm:mt-8 sm:gap-3"
          >
            <Link
              to="/shop"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-[var(--brand)] px-3.5 text-[11px] font-semibold leading-none text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-12 sm:gap-2 sm:px-6 sm:text-base"
            >
              {t('home.heroCtaShop')}
              <SiteIcon name="arrow-right" size={12} className="rtl:rotate-180" />
            </Link>
            <a
              href="#categories"
              className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--border)] bg-white/90 px-3.5 text-[11px] font-medium leading-none text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] dark:border-white/18 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white sm:h-12 sm:px-5 sm:text-base"
            >
              {t('home.heroCtaBrowse')}
            </a>
          </div>

          {/* Why buy here, at a glance */}
          <ul
            data-rise style={{ animationDelay: '300ms' }}
            className="order-4 mt-3 grid grid-cols-2 gap-1.5 text-[11px] font-medium text-[var(--fg)] sm:mt-7 sm:flex sm:flex-wrap sm:gap-2 sm:text-sm dark:text-white/90"
          >
            {TRUST.map((item) => (
              <li
                key={item.key}
                className="flex min-w-0 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]/85 px-2.5 py-1.5 shadow-soft backdrop-blur-sm sm:shrink-0 sm:gap-2 sm:whitespace-nowrap sm:rounded-full sm:px-3.5 sm:py-2 dark:border-white/10 dark:bg-white/[0.06]"
              >
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)] sm:size-6 dark:text-[var(--brand)]">
                  <SiteIcon name={item.icon} size={12} />
                </span>
                {t(item.key)}
              </li>
            ))}
          </ul>

          {/* Phones / tablets: the same deals showcase as desktop, under the headline */}
          {showDeals && !isDesktop ? (
            <div data-rise style={{ animationDelay: '160ms' }} className="order-2 mx-auto mt-4 w-full max-w-md sm:mt-6 lg:hidden">
              {deals.products.length ? <HomeDealsShowcase products={deals.products} /> : <HomeSpotlightSkeleton />}
            </div>
          ) : null}
          </div>

          {/* Desktop: product card beside the headline */}
          {showDeals && isDesktop ? (
            <div data-rise style={{ animationDelay: '200ms' }} className="hidden lg:block">
              {deals.products.length ? <HomeDealsShowcase products={deals.products} /> : <HomeSpotlightSkeleton />}
            </div>
          ) : null}
        </Container>
      </section>

      {/* Featured */}
      <section
        id="featured"
        aria-labelledby="home-featured-heading"
        className="pb-8 pt-10 sm:pb-10 sm:pt-12"
      >
        <Container>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="kicker">
                {t('home.featuredKicker')}
              </p>
              <h2
                id="home-featured-heading"
                className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
              >
                {t('home.featuredTitle')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                {t('home.featuredBody')}
              </p>
            </div>
            <Link
              to="/shop"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              {t('common.viewAll')}
              <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
            </Link>
          </div>

          {featured.isError || carousel.isError ? (
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
          ) : featured.isPending || carousel.isPending ? (
            // First load only: background refetches keep the cards (and their loaded photos) on screen
            <div className="relative min-h-[18rem] space-y-5" role="status" aria-live="polite" aria-busy="true">
              <Skeleton spinner="lg" className="h-64 rounded-[1.35rem] lg:h-[22rem]" />
              <div className="flex gap-4 overflow-hidden" aria-hidden="true">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton spinner key={i} className="h-80 w-[18.5rem] shrink-0 rounded-[1.35rem]" />
                ))}
              </div>
              {/* Each placeholder shows its own loading indicator; the label is for screen readers */}
              <span className="sr-only">{t('ui.loadingProducts')}</span>
            </div>
          ) : !featured.data?.length && !carousel.data?.length ? (
            <EmptyState
              title={t('home.featuredEmptyTitle')}
              description={t('home.featuredEmptyBody')}
              actionLabel={t('home.browseShop')}
              onAction={() => navigate('/shop')}
            />
          ) : (
            <div className="space-y-5">
              {featured.data?.[0] ? (
                <ProductCard product={featured.data[0]} variant="spotlight" />
              ) : null}
              {(carousel.data?.length
                ? carousel.data
                : featured.data?.slice(1) || []
              ).length ? (
                <ProductCarousel
                  products={
                    carousel.data?.length
                      ? carousel.data
                      : (featured.data?.slice(1) || [])
                  }
                />
              ) : null}
            </div>
          )}
        </Container>
      </section>

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

      {/* Categories — bento of the full catalog */}
      <section
        id="categories"
        aria-labelledby="home-categories-heading"
        className="scroll-mt-24 py-8 sm:py-10"
      >
        <Container>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="kicker">
                {t('home.categoriesKicker')}
              </p>
              <h2
                id="home-categories-heading"
                className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
              >
                {t('home.categoriesTitle')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                {t('home.categoriesBody')}
              </p>
            </div>
            <Link
              to="/shop"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              {t('common.allProducts')}
              <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.isLoading
                ? [
                    <Skeleton
                      key="a"
                      className="min-h-[18rem] rounded-[1.35rem] sm:col-span-2 lg:row-span-2 lg:min-h-[24rem]"
                    />,
                    <Skeleton key="b" className="min-h-[18rem] rounded-[1.35rem] lg:row-span-2 lg:min-h-[24rem]" />,
                    ...Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="min-h-[12.5rem] rounded-[1.35rem]" />
                    )),
                  ]
                : categoryList.map((c, i) => {
                    const photo = categoryPhoto(c)
                    const featuredTile = i < 2
                    const icon = categoryIcon(c.slug, c.name)
                    const name = categoryDisplayName(locale, c.slug, c.name)
                    const description = categoryDisplayDescription(
                      locale,
                      c.slug,
                      c.description
                    )
                    return (
                      // Rise in with CSS: visible at once, never waiting for the animation code
                      <div
                        key={c._id}
                        className={categoryTileClass(i, categoryList.length)}
                        data-rise="card"
                        style={{ animationDelay: `${Math.min(i, 6) * 40}ms` }}
                      >
                        <Link
                          to={`/category/${c.slug}`}
                          className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                        >
                          <div
                            className={cn(
                              // Fills the tile to its edges, rounded on all four corners like the tile
                              'relative overflow-hidden rounded-[calc(1.35rem-1px)] bg-[var(--bg-muted)]',
                              // Same photo height for every small tile, also the one stretched over a row
                              featuredTile ? 'min-h-[10.5rem] flex-1' : 'h-44 sm:h-48'
                            )}
                          >
                            {photo ? (
                              <LoadingImage
                                // Phone / computer sizes: the built-in copies, or resized when the photo's host allows it
                                src={c.image ? sizedImageUrl(photo, 960) : photo}
                                srcSet={categoryPhotoSrcSet(c) ?? (imageSrcSet(c.image, [480, 960]) || undefined)}
                                alt=""
                                width={800}
                                height={500}
                                sizes={featuredTile ? '(min-width: 1024px) 50vw, 100vw' : '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'}
                                frameClassName="absolute inset-0"
                                style={{ objectPosition: categoryPhotoPosition(c) }}
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                                loading="lazy"
                              />
                            ) : (
                              <div
                                className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,color-mix(in_srgb,var(--fg)_5%,transparent),transparent_52%)]"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="flex flex-col p-5 sm:p-6">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
                                <SiteIcon name={icon} size={18} />
                              </span>
                              <h3
                                className={cn(
                                  'font-display font-semibold tracking-tight text-[var(--fg)]',
                                  featuredTile ? 'text-xl sm:text-3xl' : 'text-base sm:text-xl'
                                )}
                              >
                                {name}
                              </h3>
                            </div>
                            {description ? (
                              <p className="mt-1.5 line-clamp-2 max-w-sm text-sm text-[var(--fg-muted)]">
                                {description}
                              </p>
                            ) : null}
                            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)]">
                              {t('common.shop')}
                              <SiteIcon
                                name="arrow-right"
                                size={16}
                                className="transition duration-300 group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
                              />
                            </span>
                          </div>
                        </Link>
                      </div>
                    )
                  })}
            </div>
          )}
          {/* Photo credits asked by the licence of some built-in photos (CC BY-SA) */}
          {categoryList.some((c) => categoryPhotoCredit(c)) ? (
            <p className="mt-3 text-[11px] text-[var(--fg-muted)]" dir="ltr">
              {categoryList
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

      {/* Last section: products by budget, then the footer */}
      <HomeBudget budgets={rows.budgets} total={rows.budgetTotal} />
    </>
  )
}
