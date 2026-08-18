import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { productsApi } from '@/api/productsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { Container } from '@/components/ui/Container'
import { ProductCard } from '@/components/product/ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=2560&q=85'

const HERO_PROOF = [
  { icon: 'package-check', label: 'Cash on delivery' },
  { icon: 'shield', label: '6-month warranty' },
  { icon: 'truck', label: 'Ships across Morocco' },
] as const

const CTA_FACTS = [
  { icon: 'package-check', label: 'Cash on delivery', hint: 'Inspect, then pay the courier' },
  { icon: 'shield', label: '6-month warranty', hint: 'From the day it arrives' },
  { icon: 'truck', label: 'Ships nationwide', hint: 'Packed for every city in Morocco' },
] as const

const CATEGORY_PHOTOS: Record<string, string> = {
  laptops: '/categories/laptops.webp',
  'gaming-pcs': '/categories/gaming-pcs.webp',
  monitors: '/categories/monitors.jpg',
  keyboards: '/categories/keyboards.jpg',
  mice: '/categories/mice.jpg',
  headphones: '/categories/headphones.jpg',
  components: '/categories/components.jpg',
  networking: '/categories/networking.jpg',
  office: '/categories/office.jpg',
  accessories: '/categories/accessories.jpg',
}

function categoryTileClass(index: number) {
  if (index === 0) return 'min-h-[18rem] sm:col-span-2 lg:col-span-2 lg:row-span-2 lg:min-h-[24rem]'
  if (index === 1) return 'min-h-[18rem] lg:row-span-2 lg:min-h-[24rem]'
  return 'min-h-[12.5rem]'
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
  if (key.includes('network') || key.includes('wifi')) return 'wifi'
  if (key.includes('office') || key.includes('chair')) return 'armchair'
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

export function Home() {
  const reduceMotion = useReducedMotion()
  const navigate = useNavigate()

  const featured = useQuery({
    queryKey: ['products', 'featured'],
    queryFn: async () => (await productsApi.list({ featured: true, limit: 8 })).data.data,
  })

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  useEffect(() => {
    const previous = document.title
    document.title = 'Brynoxa — PCs, laptops, and components'
    return () => {
      document.title = previous
    }
  }, [])

  const categoryList = categories.data ?? []

  return (
    <>
      {/* Full-bleed hero — copy sits on the photo, no boxed card */}
      <section
        aria-labelledby="home-hero-heading"
        className="relative left-1/2 w-screen -translate-x-1/2 -mt-[var(--nav-height)] flex min-h-[100svh] flex-col overflow-hidden"
      >
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={HERO_IMAGE}
            alt=""
            className={cn(
              'home-hero-photo absolute inset-0 h-full w-full max-w-none object-cover object-[72%_42%]',
              !reduceMotion && 'animate-[home-hero-ken_18s_ease-out_forwards]'
            )}
            fetchPriority="high"
          />
          <div className="absolute inset-0 hidden dark:block bg-[linear-gradient(105deg,rgba(8,11,14,0.94)_0%,rgba(8,11,14,0.72)_46%,rgba(8,11,14,0.38)_100%)]" />
          <div className="absolute inset-0 hidden dark:block bg-[radial-gradient(ellipse_55%_50%_at_78%_42%,rgba(0,194,255,0.2),transparent_62%)]" />
          <div className="absolute inset-0 dark:hidden bg-[linear-gradient(105deg,rgb(238_242_245/0.88)_0%,rgb(238_242_245/0.58)_34%,rgb(238_242_245/0.12)_58%,transparent_76%)]" />
          <div className="absolute inset-0 dark:hidden bg-[radial-gradient(ellipse_50%_40%_at_12%_22%,rgb(0_194_255/0.12),transparent_58%)]" />
        </div>

        <Container className="relative z-10 flex flex-1 flex-col justify-center pb-8 pt-[calc(var(--nav-height)+1.5rem)] sm:pb-10">
          <motion.p
            {...fadeUp(reduceMotion, 0)}
            className="kicker sm:text-sm dark:text-[var(--brand)]"
          >
            Morocco · cash on delivery
          </motion.p>

          <motion.h1
            id="home-hero-heading"
            {...fadeUp(reduceMotion, 0.08)}
            className="mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tight text-balance text-[var(--fg)] sm:text-5xl md:text-6xl dark:text-white"
          >
            Laptops, gaming PCs,
            <span className="block text-[var(--brand-text)] dark:text-[var(--brand)]">
              and components
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp(reduceMotion, 0.16)}
            className="mt-5 max-w-lg text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg dark:text-white/72"
          >
            Prices in DH. Gaming PCs, laptops, monitors, and parts — pay the courier when the box
            arrives.
          </motion.p>

          <motion.div
            {...fadeUp(reduceMotion, 0.24)}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Link
              to="/shop"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-base font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            >
              Shop now
              <SiteIcon name="arrow-right" size={16} />
            </Link>
            <a
              href="#categories"
              className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)]/90 px-5 text-base font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] dark:border-white/18 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 dark:hover:text-white"
            >
              Browse categories
            </a>
          </motion.div>
        </Container>

        <div className="relative z-10 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-elevated)_62%,transparent)] backdrop-blur-xl dark:border-white/10 dark:bg-black/35">
          <Container className="grid sm:grid-cols-3">
            {HERO_PROOF.map(({ icon, label }, i) => (
              <div
                key={label}
                className={cn(
                  'flex items-center gap-3 py-4 sm:justify-center sm:py-5',
                  i > 0 && 'sm:border-l sm:border-[var(--border)] dark:sm:border-white/10'
                )}
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)] dark:text-[var(--brand)]">
                  <SiteIcon name={icon} size={18} />
                </span>
                <p className="text-sm font-medium text-[var(--fg)] dark:text-white/90">{label}</p>
              </div>
            ))}
          </Container>
        </div>
      </section>

      {/* Featured */}
      <section
        id="featured"
        aria-labelledby="home-featured-heading"
        className="pb-16 pt-14 sm:pb-20 sm:pt-16"
      >
        <Container>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="kicker">
                Featured
              </p>
              <h2
                id="home-featured-heading"
                className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Featured
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                Ready for cash on delivery — prices in DH.
              </p>
            </div>
            <Link
              to="/shop"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              View all
              <SiteIcon name="arrow-right" size={16} />
            </Link>
          </div>

          {featured.isError ? (
            <EmptyState
              icon="package-open"
              title="Couldn’t load featured products"
              description="Check your connection and try again."
              actionLabel="Retry"
              onAction={() => featured.refetch()}
            />
          ) : featured.isLoading ? (
            <div className="space-y-5">
              <Skeleton className="h-72 rounded-[1.35rem] lg:h-[26rem]" />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-80 rounded-[1.35rem]" />
                ))}
              </div>
            </div>
          ) : !featured.data?.length ? (
            <EmptyState
              title="No featured products yet"
              description="New arrivals will appear here soon."
              actionLabel="Browse shop"
              onAction={() => navigate('/shop')}
            />
          ) : (
            <div className="space-y-5">
              <ProductCard product={featured.data[0]} variant="spotlight" />
              {featured.data.length > 1 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {featured.data.slice(1).map((p) => (
                    <ProductCard key={p._id} product={p} />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </Container>
      </section>

      {/* Categories — bento of the full catalog */}
      <section
        id="categories"
        aria-labelledby="home-categories-heading"
        className="scroll-mt-24 border-t border-[var(--border)] py-16 sm:py-20"
      >
        <Container>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="kicker">
                Categories
              </p>
              <h2
                id="home-categories-heading"
                className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Shop by category
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                Laptops, gaming PCs, monitors, keyboards, and more.
              </p>
            </div>
            <Link
              to="/shop"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
            >
              All products
              <SiteIcon name="arrow-right" size={16} />
            </Link>
          </div>

          {categories.isError ? (
            <EmptyState
              title="Couldn’t load categories"
              description="Something went wrong fetching the catalog."
              actionLabel="Retry"
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
                    return (
                      <motion.div
                        key={c._id}
                        className={categoryTileClass(i)}
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
                              'relative overflow-hidden bg-[color-mix(in_srgb,var(--brand)_8%,var(--bg))]',
                              featuredTile ? 'min-h-[10.5rem] flex-1' : 'aspect-[16/10]'
                            )}
                          >
                            {photo ? (
                              <img
                                src={photo}
                                alt=""
                                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                                loading="lazy"
                              />
                            ) : (
                              <div
                                className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,color-mix(in_srgb,var(--brand)_18%,transparent),transparent_52%)]"
                                aria-hidden="true"
                              />
                            )}
                          </div>
                          <div className="flex flex-col p-5 sm:p-6">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)] dark:text-[var(--brand)]">
                                <SiteIcon name={icon} size={18} />
                              </span>
                              <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--fg-muted)]">
                                {String(i + 1).padStart(2, '0')}
                              </p>
                            </div>
                            <h3
                              className={cn(
                                'mt-3 font-display font-semibold tracking-tight text-[var(--fg)]',
                                featuredTile ? 'text-2xl sm:text-3xl' : 'text-xl'
                              )}
                            >
                              {c.name}
                            </h3>
                            {c.description ? (
                              <p className="mt-1.5 line-clamp-2 max-w-sm text-sm text-[var(--fg-muted)]">
                                {c.description}
                              </p>
                            ) : null}
                            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-text)]">
                              Shop
                              <SiteIcon
                                name="arrow-right"
                                size={16}
                                className="transition duration-300 group-hover:translate-x-0.5"
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

      {/* Closing CTA — COD close, split with proof */}
      <section
        aria-labelledby="home-cta-heading"
        className="border-t border-[var(--border)] py-16 sm:py-20"
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
            <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_18.5rem] lg:gap-16">
              <div>
                <p className="kicker">
                  Cash on delivery
                </p>
                <h2
                  id="home-cta-heading"
                  className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl"
                >
                  Pay when it arrives
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
                  Check the package at the door, then pay cash. No card, no deposit.
                </p>
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to="/shop"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-6 text-base font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
                  >
                    Shop now
                    <SiteIcon name="arrow-right" size={16} />
                  </Link>
                  <Link
                    to="/contact"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg)] px-5 text-base font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] dark:bg-white/5"
                  >
                    Contact
                  </Link>
                </div>
              </div>

              <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {CTA_FACTS.map(({ icon, label, hint }) => (
                  <li
                    key={label}
                    className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/80 px-4 py-3.5 dark:bg-black/20"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] text-[var(--brand-text)] dark:text-[var(--brand)]">
                      <SiteIcon name={icon} size={18} />
                    </span>
                    <span>
                      <p className="text-sm font-semibold text-[var(--fg)]">{label}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[var(--fg-muted)]">{hint}</p>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </Container>
      </section>
    </>
  )
}
