import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useHeroProduct } from '@/hooks/useHeroProduct'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { HeroPage, Product } from '@/types'

/** Light card in light mode, glass on the photo in dark mode. */
export const heroGhostPill =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-11 sm:px-5 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur-sm dark:hover:bg-white/15'

export const heroPrimaryPill =
  'inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-5 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-11 sm:px-6'

export const heroChip =
  'inline-flex h-7 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2.5 text-[11px] font-medium text-[var(--fg-muted)] sm:h-8 sm:px-3 sm:text-xs dark:border-white/15 dark:bg-black/30 dark:text-white dark:backdrop-blur-sm'

export const heroInput =
  'h-10 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-4 text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--brand)] sm:h-11 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur-sm dark:placeholder:text-white/55'

const fadeUp = (reduce: boolean | null, delay = 0) =>
  reduce
    ? { initial: false as const, animate: { opacity: 1 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
      }

function HeroProductCard({ product }: { product: Product }) {
  const t = useT()
  const image = product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url
  const brand = typeof product.brand === 'object' ? product.brand?.name : undefined
  const onSale = product.compareAtPrice != null && product.compareAtPrice > product.price

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group relative block aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] shadow-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] lg:aspect-[16/10] dark:border-white/10"
    >
      <SafeImage
        src={optimizedImageUrl(image, 1400)}
        alt={product.name}
        width={1600}
        height={1000}
        sizes="(min-width: 768px) 60vw, 100vw"
        className="absolute inset-0 h-full w-full max-w-none object-cover transition duration-500 group-hover:scale-[1.03]"
        fetchPriority="high"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent"
        aria-hidden="true"
      />

      <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2 sm:inset-x-4 sm:top-4">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 text-[11px] font-semibold text-[var(--brand-fg)] shadow-glow sm:text-xs">
          <SiteIcon name="star" size={12} />
          {t('product.featuredPick')}
        </span>
        {onSale ? (
          <span className="inline-flex h-7 items-center rounded-full bg-black/55 px-2.5 text-[11px] font-bold text-white backdrop-blur-sm sm:text-xs">
            −{Math.round((1 - product.price / product.compareAtPrice!) * 100)}%
          </span>
        ) : null}
      </div>

      <div className="absolute inset-x-2.5 bottom-2.5 flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-black/45 px-3 py-2.5 backdrop-blur-md sm:inset-x-4 sm:bottom-4 sm:items-end sm:p-4">
        <div className="min-w-0">
          {brand ? (
            <p className="hidden text-[11px] font-medium uppercase tracking-wider text-white/65 sm:block">
              {brand}
            </p>
          ) : null}
          <p className="truncate font-display text-base font-semibold text-white sm:text-lg">
            {product.name}
          </p>
          <p className="mt-0.5 flex items-baseline gap-2">
            <span className="font-display text-lg font-semibold text-[var(--brand)] sm:text-xl">
              {formatCurrency(product.price)}
            </span>
            {onSale ? (
              <span className="text-xs text-white/60 line-through sm:text-sm">
                {formatCurrency(product.compareAtPrice!)}
              </span>
            ) : null}
          </p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-white text-xs font-semibold text-[#0c1218] transition group-hover:bg-[var(--brand)] group-hover:text-[var(--brand-fg)] sm:h-10 sm:w-auto sm:px-4 sm:text-sm">
          <span className="sr-only sm:not-sr-only">{t('product.viewProduct')}</span>
          <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
        </span>
      </div>
    </Link>
  )
}

export function StoreHero({
  page,
  kicker,
  titleLead,
  titleAccent,
  description,
  image,
  imagePosition = 'object-center',
  framePosition = 'object-center',
  titleId = 'page-heading',
  maxWidthClassName = 'max-w-7xl',
  children,
}: {
  /** Which Admin → Settings → Page headers product to feature. */
  page: HeroPage
  kicker: string
  titleLead: ReactNode
  titleAccent?: ReactNode
  description?: ReactNode
  image: string
  /** Crop of the full-bleed dark-mode background. */
  imagePosition?: string
  /** Crop of the framed light-mode picture. */
  framePosition?: string
  titleId?: string
  /** Match the page's content width so the light-mode card lines up with it. */
  maxWidthClassName?: string
  children?: ReactNode
}) {
  const reduceMotion = useReducedMotion()
  const { product, pending } = useHeroProduct(page)
  const showcase = Boolean(product) || pending

  return (
    <section
      aria-labelledby={titleId}
      className="relative -mt-[var(--nav-height)] w-full pt-[calc(var(--nav-height)+0.75rem)] dark:pt-0"
    >
      <div
        className={cn(
          'mx-auto px-4 sm:px-6 lg:px-8 dark:max-w-none dark:px-0',
          maxWidthClassName
        )}
      >
        <div className="relative overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft dark:rounded-none dark:border-0 dark:bg-[#080b0e] dark:shadow-none">
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_0%_0%,rgba(0,194,255,0.12),transparent_55%)] rtl:-scale-x-100 dark:hidden"
            aria-hidden="true"
          />

          <div className="absolute inset-0 hidden dark:block" aria-hidden="true">
            {showcase ? (
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_30%,rgba(0,194,255,0.16),transparent_60%)] rtl:-scale-x-100" />
            ) : (
              <>
                <SafeImage
                  src={image}
                  alt=""
                  width={2560}
                  height={1440}
                  sizes="100vw"
                  className={cn('absolute inset-0 h-full w-full max-w-none object-cover', imagePosition)}
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(8,11,14,0.95)_0%,rgba(8,11,14,0.8)_45%,rgba(8,11,14,0.45)_100%)] rtl:-scale-x-100" />
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--bg)] to-transparent" />
          </div>

          <Container
            className={cn(
              'relative z-10 grid items-center gap-6 px-5 py-7 sm:px-8 sm:py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10 lg:px-10 lg:py-8',
              !showcase && 'dark:grid-cols-1!',
              'dark:px-4 dark:pb-8 dark:pt-[calc(var(--nav-height)+1.25rem)] sm:dark:px-6 sm:dark:pb-10 sm:dark:pt-[calc(var(--nav-height)+2rem)] lg:dark:px-8',
              maxWidthClassName
            )}
          >
            <div className="min-w-0">
              <motion.p
                {...fadeUp(reduceMotion, 0)}
                className="kicker text-[11px] text-[var(--brand-text)] sm:text-xs dark:text-[var(--brand)]"
              >
                {kicker}
              </motion.p>

              <motion.h1
                id={titleId}
                {...fadeUp(reduceMotion, 0.06)}
                className="mt-2 max-w-2xl font-display text-2xl font-semibold leading-tight tracking-tight text-balance text-[var(--fg)] sm:text-4xl md:text-[2.625rem] dark:text-white"
              >
                {titleLead}
                {titleAccent ? (
                  <span className="block text-[var(--brand-text)] dark:text-[var(--brand)]">{titleAccent}</span>
                ) : null}
              </motion.h1>

              {description ? (
                <motion.div
                  {...fadeUp(reduceMotion, 0.12)}
                  className="mt-2 max-w-lg text-[13px] leading-relaxed text-[var(--fg-muted)] sm:mt-3 sm:text-[15px] dark:text-white/75"
                >
                  {description}
                </motion.div>
              ) : null}

              {children ? (
                <motion.div {...fadeUp(reduceMotion, 0.18)} className="mt-4 sm:mt-5">
                  {children}
                </motion.div>
              ) : null}
            </div>

            {product ? (
              <motion.div {...fadeUp(reduceMotion, 0.1)} className="relative">
                <div
                  className="absolute -inset-3 rounded-[1.75rem] bg-[radial-gradient(closest-side,rgba(0,194,255,0.22),transparent)]"
                  aria-hidden="true"
                />
                <HeroProductCard product={product} />
              </motion.div>
            ) : pending ? (
              <div
                className="relative hidden aspect-[4/3] animate-pulse rounded-2xl bg-[var(--bg-muted)] md:block lg:aspect-[16/10] dark:bg-white/5"
                aria-hidden="true"
              />
            ) : (
              <motion.div
                {...fadeUp(reduceMotion, 0.1)}
                className="relative hidden md:block dark:hidden!"
                aria-hidden="true"
              >
                <div className="absolute -inset-3 rounded-[1.75rem] bg-[radial-gradient(closest-side,rgba(0,194,255,0.22),transparent)]" />
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] shadow-soft lg:aspect-[16/10]">
                  <SafeImage
                    src={image}
                    alt=""
                    width={1600}
                    height={1000}
                    sizes="(min-width: 768px) 60vw, 0px"
                    className={cn('h-full w-full max-w-none object-cover', framePosition)}
                  />
                </div>
              </motion.div>
            )}
          </Container>
        </div>
      </div>
    </section>
  )
}
