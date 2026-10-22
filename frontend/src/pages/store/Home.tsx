import { useSyncExternalStore } from 'react'
import { LoadingImage } from '@/components/ui/ImageLoader'
import { Link, useNavigate } from 'react-router-dom'
import { useHomeDeals } from '@/hooks/useHomeDeals'
import { HeroBackdrop } from '@/components/home/HeroBackdrop'
import { HomeDealsShowcase } from '@/components/home/HomeDeals'
import { HomeSpotlightSkeleton } from '@/components/home/HomeSpotlight'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { Container } from '@/components/ui/Container'
import { ProductCard } from '@/components/product/ProductCard'
import { ProductCarousel } from '@/components/product/ProductCarousel'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { useSeo } from '@/hooks/useSeo'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayDescription, categoryDisplayName } from '@/i18n'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=2560&q=85'

const CATEGORY_PHOTOS: Record<string, string> = {
  laptops: '/categories/laptops.webp',
  'gaming-pcs': '/categories/gaming-pcs.webp',
  monitors: '/categories/monitors.jpg',
  keyboards: '/categories/keyboards.jpg',
  mice: '/categories/mice.jpg',
  headphones: '/categories/headphones.jpg',
  components: '/categories/components.jpg',
  accessories: '/categories/accessories.jpg',
}

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

function categoryIcon(slug: string, name: string): SiteIconName {
  const key = `${slug} ${name}`.toLowerCase()
  if (key.includes('laptop')) return 'laptop'
  if (key.includes('gaming')) return 'gamepad'
  if (key.includes('monitor')) return 'monitor'
  if (key.includes('keyboard')) return 'keyboard'
  if (key.includes('mice') || key.includes('mouse')) return 'mouse'
  if (key.includes('headphone') || key.includes('audio')) return 'headphones'
  if (key.includes('component')) return 'cpu'
  return 'package'
}

const fadeUp = (reduce: boolean | null, delay = 0) =>
  reduce
    ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 18 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as const },
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
  { key: 'home.proofCod', icon: 'banknote' },
  { key: 'home.proofDelivery', icon: 'truck' },
  { key: 'home.proofWarranty', icon: 'shield' },
  { key: 'home.proofReturns', icon: 'refresh' },
] as const

export function Home() {
  const reduceMotion = useReducedMotion()
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

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  useSeo({
    title: t('meta.homeTitle'),
    description: t('meta.homeDescription'),
    path: '/',
    image: HERO_IMAGE,
  })

  const categoryList = (categories.data ?? []).filter(
    (c) => c.slug !== 'office' && c.slug !== 'networking'
  )

  return (
    <>
      <section
        aria-labelledby="home-hero-heading"
        className="relative -mt-[var(--nav-height)] flex w-full flex-col overflow-hidden bg-[var(--bg)] sm:min-h-[100svh]"
      >
        <HeroBackdrop />

        <Container className="relative z-10 grid flex-1 items-center [align-content:safe_center] gap-8 pb-6 pt-[calc(var(--nav-height)+0.75rem)] sm:pb-10 sm:pt-[calc(var(--nav-height)+1.75rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] xl:gap-14">
          {/* Phones: headline → deals → buttons → trust chips. Tablet / desktop: normal order */}
          <div className="flex min-w-0 flex-col sm:block">
          {/* Hidden on phones (wrapper: .kicker sets its own display) */}
          <motion.div {...fadeUp(reduceMotion, 0)} className="max-sm:hidden">
            <p className="inline-flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--brand)_35%,transparent)] bg-[color-mix(in_srgb,var(--brand)_10%,var(--bg-elevated))] px-3.5 py-1.5 font-display text-sm font-semibold text-[var(--brand-text)] shadow-soft dark:bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] dark:text-[var(--brand)]">
              <span className="size-2 rounded-full bg-[var(--brand)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--brand)_22%,transparent)]" />
              {t('home.kicker')}
            </p>
          </motion.div>

          <motion.h1
            id="home-hero-heading"
            {...fadeUp(reduceMotion, 0.08)}
            className="order-1 max-w-2xl font-display text-base font-bold leading-snug tracking-tight sm:mt-5 text-balance text-[var(--fg)] sm:text-5xl md:text-6xl dark:text-white"
          >
            {t('home.heroTitleLead')}
            <span className="block">
              <span className="relative isolate inline-block">
                {/* marker stroke under the accent words */}
                <span
                  className="absolute inset-x-[-0.08em] bottom-[0.06em] h-[0.3em] rounded-full bg-[color-mix(in_srgb,var(--brand)_26%,transparent)] dark:bg-[color-mix(in_srgb,var(--brand)_28%,transparent)]"
                  aria-hidden="true"
                />
                <span className="relative bg-gradient-to-r from-[#0077b6] via-[#0096d6] to-[#00b4ef] bg-clip-text text-transparent dark:from-[#00c2ff] dark:via-[#38d2ff] dark:to-[#9be8ff]">
                  {t('home.heroTitleAccent')}
                </span>
              </span>
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(reduceMotion, 0.16)}
            className="mt-3 max-w-lg text-[13px] font-medium leading-relaxed text-[var(--fg)]/75 max-sm:hidden sm:mt-5 sm:text-lg dark:text-white/85"
          >
            {t('home.heroBody')}
          </motion.p>

          <motion.div
            {...fadeUp(reduceMotion, 0.24)}
            className="order-3 mt-3 flex flex-wrap items-center gap-2 sm:mt-8 sm:gap-3"
          >
            <Link
              to="/shop"
              className="inline-flex h-8 items-center justify-center gap-1 rounded-full bg-[var(--brand)] px-3.5 text-[11px] font-semibold leading-none text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-12 sm:gap-2 sm:px-6 sm:text-base"
            >
              {t('common.shopNow')}
              <SiteIcon name="arrow-right" size={12} className="rtl:rotate-180" />
            </Link>
            <a
              href="#categories"
              className="inline-flex h-8 items-center justify-center rounded-full border border-[var(--border)] bg-white/90 px-3.5 text-[11px] font-medium leading-none text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] dark:border-white/18 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white sm:h-12 sm:px-5 sm:text-base"
            >
              {t('common.browseCategories')}
            </a>
          </motion.div>

          {/* Why buy here, at a glance */}
          <motion.ul
            {...fadeUp(reduceMotion, 0.3)}
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
          </motion.ul>

          {/* Phones / tablets: the same deals showcase as desktop, under the headline */}
          {showDeals && !isDesktop ? (
            <motion.div {...fadeUp(reduceMotion, 0.16)} className="order-2 mx-auto mt-4 w-full max-w-md sm:mt-6 lg:hidden">
              {deals.products.length ? <HomeDealsShowcase products={deals.products} /> : <HomeSpotlightSkeleton />}
            </motion.div>
          ) : null}
          </div>

          {/* Desktop: product card beside the headline */}
          {showDeals && isDesktop ? (
            <motion.div {...fadeUp(reduceMotion, 0.2)} className="hidden lg:block">
              {deals.products.length ? <HomeDealsShowcase products={deals.products} /> : <HomeSpotlightSkeleton />}
            </motion.div>
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
                    const photo = CATEGORY_PHOTOS[c.slug] ?? c.image
                    const featuredTile = i < 2
                    const icon = categoryIcon(c.slug, c.name)
                    const name = categoryDisplayName(locale, c.slug, c.name)
                    const description = categoryDisplayDescription(
                      locale,
                      c.slug,
                      c.description
                    )
                    return (
                      <motion.div
                        key={c._id}
                        className={categoryTileClass(i, categoryList.length)}
                        initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: '-40px' }}
                        transition={{
                          delay: Math.min(i, 6) * 0.04,
                          duration: 0.4,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        <Link
                          to={`/category/${c.slug}`}
                          className="group flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                        >
                          <div
                            className={cn(
                              'relative overflow-hidden bg-[var(--bg-muted)]',
                              // Same photo height for every small tile, also the one stretched over a row
                              featuredTile ? 'min-h-[10.5rem] flex-1' : 'h-44 sm:h-48'
                            )}
                          >
                            {photo ? (
                              <LoadingImage
                                src={photo}
                                alt=""
                                width={800}
                                height={500}
                                sizes="(min-width: 1024px) 33vw, 100vw"
                                frameClassName="absolute inset-0"
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
                      </motion.div>
                    )
                  })}
            </div>
          )}
        </Container>
      </section>

      {/* Closing CTA */}
      <section
        aria-labelledby="home-cta-heading"
        className="pb-12 pt-8 sm:pb-14 sm:pt-10"
      >
        <Container>
          <motion.div
            className="cta-band relative overflow-hidden rounded-[1.75rem] px-6 py-10 sm:px-10 sm:py-12 lg:px-14 lg:py-14"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <SiteIcon
              name="package-check"
              size={96}
              className="pointer-events-none absolute -left-8 bottom-[-2rem] text-[var(--brand)] opacity-[0.12]"
            />
            <div className="relative max-w-2xl">
              <p className="kicker">{t('home.ctaKicker')}</p>
              <h2
                id="home-cta-heading"
                className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-4xl"
              >
                {t('home.ctaTitle')}
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                {t('home.ctaBody')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/shop"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-base font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                >
                  {t('common.shopNow')}
                  <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 text-base font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] dark:bg-white/5"
                >
                  {t('common.contact')}
                </Link>
              </div>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  )
}
