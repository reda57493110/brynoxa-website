import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Container } from '@/components/ui/Container'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useHeroProduct } from '@/hooks/useHeroProduct'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { HeroPage, Product } from '@/types'

/** Light card in light mode, glass on the photo in dark mode. */
export const heroGhostPill =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg)] px-3.5 text-[13px] font-medium sm:text-sm text-[var(--fg)] transition hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-11 sm:px-5 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur-sm dark:hover:bg-white/15'

export const heroPrimaryPill =
  'inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 text-[13px] font-semibold sm:text-sm text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:h-11 sm:px-6'

export const heroChip =
  'inline-flex h-6 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg)] px-2 text-[10px] font-medium text-[var(--fg-muted)] sm:h-8 sm:px-3 sm:text-xs dark:border-white/15 dark:bg-black/30 dark:text-white dark:backdrop-blur-sm'

export const heroInput =
  'h-9 min-w-0 flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-3.5 text-[13px] sm:text-sm text-[var(--fg)] outline-none placeholder:text-[var(--fg-muted)] focus:border-[var(--brand)] sm:h-11 dark:border-white/20 dark:bg-white/10 dark:text-white dark:backdrop-blur-sm dark:placeholder:text-white/55'

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
      className="group relative block overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft transition hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] dark:border-white/10 dark:bg-[#0e1419]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-muted)] md:aspect-[16/10] lg:aspect-[16/9]">
        <SafeImage
          src={sizedImageUrl(image, 1600)}
          alt={product.name}
          width={1600}
          height={1000}
          sizes="(min-width: 768px) 60vw, 100vw"
          className="absolute inset-0 h-full w-full max-w-none object-cover transition duration-500 group-hover:scale-[1.04]"
          fetchPriority="high"
        />
        <div
          className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent"
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
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-3.5 py-2.5 sm:px-5 sm:py-3.5 dark:border-white/10">
        <div className="min-w-0">
          {brand ? (
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-muted)] dark:text-white/60">
              {brand}
            </p>
          ) : null}
          <p className="line-clamp-2 font-display text-sm font-semibold leading-snug text-[var(--fg)] sm:text-lg dark:text-white">
            {product.name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <p className="hidden flex-col items-end leading-tight sm:flex">
            <span className="font-display text-lg font-semibold text-[var(--brand-text)] sm:text-xl dark:text-[var(--brand)]">
              {formatCurrency(product.price)}
            </span>
            {onSale ? (
              <span className="text-xs text-[var(--fg-muted)] line-through dark:text-white/50">
                {formatCurrency(product.compareAtPrice!)}
              </span>
            ) : null}
          </p>
          <span className="font-display text-base font-semibold text-[var(--brand-text)] sm:hidden dark:text-[var(--brand)]">
            {formatCurrency(product.price)}
          </span>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--brand)] text-xs font-semibold text-[var(--brand-fg)] shadow-glow transition group-hover:brightness-110 sm:h-10 sm:w-auto sm:px-4 sm:text-sm">
          <span className="sr-only sm:not-sr-only">{t('product.viewProduct')}</span>
          <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
        </span>
        </div>
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
  frameOverlay,
  children,
}: {
  /** Feature the Admin → Settings → Page header product; omit to show the photo. */
  page?: HeroPage
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
  /** Decorative badges laid over the photo (absolutely positioned by the caller). */
  frameOverlay?: ReactNode
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
                  className={cn('absolute inset-0 h-full w-full max-w-none object-cover max-md:hidden', imagePosition)}
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(8,11,14,0.95)_0%,rgba(8,11,14,0.8)_45%,rgba(8,11,14,0.45)_100%)] max-md:hidden rtl:-scale-x-100" />
              </>
            )}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[var(--bg)] to-transparent" />
          </div>

          <Container
            className={cn(
              'relative z-10 grid items-center gap-3.5 px-3 py-3 sm:gap-6 sm:px-8 sm:py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:gap-10 lg:px-10 lg:py-8',
              !showcase && 'md:dark:grid-cols-1!',
              'dark:px-3 dark:pb-6 dark:pt-[calc(var(--nav-height)+0.75rem)] sm:dark:px-6 sm:dark:pb-10 sm:dark:pt-[calc(var(--nav-height)+2rem)] lg:dark:px-8',
              maxWidthClassName
            )}
          >
            <div className="min-w-0">
              <motion.p
                {...fadeUp(reduceMotion, 0)}
                className="kicker text-[10px] text-[var(--brand-text)] sm:text-xs dark:text-[var(--brand)]"
              >
                {kicker}
              </motion.p>

              <motion.h1
                id={titleId}
                {...fadeUp(reduceMotion, 0.06)}
                className="mt-1.5 max-w-2xl font-display text-[1.125rem] font-semibold leading-[1.2] tracking-tight text-balance text-[var(--fg)] sm:mt-2 sm:text-4xl sm:leading-tight md:text-[2.625rem] dark:text-white"
              >
                {titleLead}
                {titleAccent ? (
                  <span className="block text-[var(--brand-text)] dark:text-[var(--brand)]">{titleAccent}</span>
                ) : null}
              </motion.h1>

              {description ? (
                <motion.div
                  {...fadeUp(reduceMotion, 0.12)}
                  className="mt-1.5 max-w-lg text-xs leading-relaxed text-[var(--fg-muted)] sm:mt-3 sm:text-[15px] dark:text-white/75"
                >
                  {description}
                </motion.div>
              ) : null}

              {children ? (
                <motion.div {...fadeUp(reduceMotion, 0.18)} className="mt-3 sm:mt-5">
                  {children}
                </motion.div>
              ) : null}
            </div>

            {product ? (
              <motion.div {...fadeUp(reduceMotion, 0.1)} className="relative order-first md:order-none">
                <div
                  className="absolute -inset-3 hidden rounded-[1.75rem] bg-[radial-gradient(closest-side,rgba(0,194,255,0.22),transparent)] dark:block"
                  aria-hidden="true"
                />
                <HeroProductCard product={product} />
              </motion.div>
            ) : pending ? (
              <div
                className="relative order-first aspect-[4/3.6] animate-pulse rounded-2xl bg-[var(--bg-muted)] md:order-none md:aspect-[4/3] lg:aspect-[16/10] dark:bg-white/5"
                aria-hidden="true"
              />
            ) : (
              <motion.div
                {...fadeUp(reduceMotion, 0.1)}
                className="relative order-first md:order-none md:dark:hidden!"
                aria-hidden="true"
              >
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)] shadow-soft lg:aspect-[16/10] dark:border-white/10">
                  <SafeImage
                    src={image}
                    alt=""
                    width={1600}
                    height={1000}
                    sizes="(min-width: 768px) 60vw, 100vw"
                    className={cn('h-full w-full max-w-none object-cover', framePosition)}
                  />
                  {frameOverlay}
                </div>
              </motion.div>
            )}

            {frameOverlay && !showcase ? (
              <div
                className="pointer-events-none absolute bottom-8 end-4 top-[calc(var(--nav-height)+1.5rem)] hidden w-[26rem] lg:dark:block"
                aria-hidden="true"
              >
                {frameOverlay}
              </div>
            ) : null}
          </Container>
        </div>
      </div>
    </section>
  )
}
