import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { SafeImage } from '@/components/ui/SafeImage'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'
import { Link } from 'react-router-dom'
import { LoadingImage } from '@/components/ui/ImageLoader'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { HomeSpotlightCard, StockLine, deal, useAddToCart } from './HomeSpotlight'

/** Time each deal stays in the big card before the next one (desktop). */
const ROTATE_MS = 6000

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

function percentOff(p: Product) {
  return p.compareAtPrice != null && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : null
}

/**
 * Desktop: the active deal in the big spotlight card, the others as thumbnails underneath.
 * Rotates every few seconds; hovering, focusing or picking a deal pauses it.
 */
export function HomeDealsShowcase({ products }: { products: Product[] }) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [picked, setPicked] = useState(false)
  const many = products.length > 1
  const active = products[Math.min(index, products.length - 1)]

  useEffect(() => {
    if (index >= products.length) setIndex(0)
  }, [products.length, index])

  // Auto-rotate (not after the visitor picked a deal, not for reduced motion)
  useEffect(() => {
    if (!many || paused || picked || reduceMotion) return
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % products.length), ROTATE_MS)
    return () => window.clearTimeout(id)
  }, [index, many, paused, picked, reduceMotion, products.length])

  if (!active) return null

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* All deals rendered once inside one frame; switching crossfades them (no reload, no jump) */}
      <HomeSpotlightCard products={products} active={products.indexOf(active)} />

      {many ? (
        <div
          role="tablist"
          aria-label={t('home.dealsLabel')}
          className="mt-4 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${products.length}, minmax(0, 1fr))` }}
        >
          {products.map((p, i) => {
            const on = p._id === active._id
            const image = primaryImage(p)
            const off = percentOff(p)
            return (
              <button
                key={p._id}
                type="button"
                role="tab"
                aria-selected={on}
                aria-label={p.name}
                onClick={() => {
                  setIndex(i)
                  setPicked(true)
                }}
                title={p.name}
                className={cn(
                  'group/deal relative flex min-w-0 flex-col overflow-hidden rounded-xl border text-start transition duration-200 hover:-translate-y-0.5',
                  on
                    ? 'border-[var(--brand)] bg-[#0b1116] shadow-glow'
                    : 'border-transparent bg-[#0b1116] shadow-[0_8px_20px_-12px_rgb(15_23_42/0.45)] hover:border-[var(--brand)] dark:border-white/10 dark:shadow-none dark:hover:border-white/30'
                )}
              >
                <span
                  className={cn(
                    'relative block h-16 w-full overflow-hidden',
                    imageFit(image) === 'contain' ? 'bg-white' : 'bg-white/10'
                  )}
                >
                  {image ? (
                    <SafeImage
                      src={sizedImageUrl(image, 240)}
                      alt=""
                      width={160}
                      height={64}
                      loading="eager"
                      referrerPolicy="no-referrer"
                      className={cn('h-full w-full transition duration-300 group-hover/deal:scale-105', imageFit(image) === 'contain' ? 'object-contain p-1.5 mix-blend-multiply' : 'object-cover', !on && 'opacity-75 group-hover/deal:opacity-100')}
                    />
                  ) : null}
                  {off ? (
                    <span className="absolute end-1 top-1 rounded-md bg-[var(--brand)] px-1.5 text-[10px] font-bold leading-4 text-[var(--brand-fg)] shadow-glow">
                      −{off}%
                    </span>
                  ) : null}
                </span>
                <span className="flex min-w-0 items-center justify-between gap-1 px-2 py-1.5">
                  <span className={cn('truncate text-xs font-semibold', on ? 'text-white' : 'text-white/80')}>{formatCurrency(p.price)}</span>
                </span>
                {/* Time left before the next deal */}
                {on && !picked && !reduceMotion ? (
                  <span
                    key={`${p._id}-${index}`}
                    className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-[var(--brand)] motion-safe:animate-[deal-progress_6s_linear_forwards] rtl:origin-right"
                    style={{ animationPlayState: paused ? 'paused' : 'running' }}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/** Phone / tablet deal card: big photo, deal tag and discount, name, price, stock and a cart button. */
function DealMiniCard({ product }: { product: Product }) {
  const t = useT()
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const contain = imageFit(image) === 'contain'
  const d = deal(product)
  const href = `/product/${product.slug}`

  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-[1.25rem] bg-[#0b1116] text-white shadow-[0_18px_40px_-22px_rgb(15_23_42/0.7)] ring-1 ring-black/5 dark:shadow-[0_18px_44px_-20px_rgb(0_194_255/0.4)] dark:ring-white/10">
      <Link to={href} className="relative block" tabIndex={-1} aria-hidden="true">
        <div className={cn('relative aspect-[16/11] overflow-hidden', contain ? 'bg-white' : 'bg-white/5')}>
          {image ? (
            <LoadingImage
              src={sizedImageUrl(image, 640)}
              alt=""
              width={640}
              height={400}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              frameClassName="absolute inset-0"
              className={cn('h-full w-full', contain ? 'object-contain p-3 pb-5 mix-blend-multiply' : 'object-cover')}
            />
          ) : null}
          <span className="absolute start-2 top-2 inline-flex h-5 items-center gap-1 rounded-full bg-[#0b1116]/85 px-1.5 text-[9px] font-semibold uppercase tracking-wide">
            <SiteIcon name="star" size={9} solid className="text-[var(--brand)]" />
            {d ? t('home.spotlightDeal') : t('product.featuredPick')}
          </span>
          {d ? (
            <span className="absolute end-2 top-2 inline-flex h-6 items-center rounded-full bg-[var(--brand)] px-2 font-display text-xs font-bold text-[var(--brand-fg)] shadow-glow">
              −{d.percent}%
            </span>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[#0b1116] to-transparent" />
        </div>
      </Link>

      <div className="relative -mt-1 flex flex-1 flex-col gap-1.5 p-3 pt-0">
        <Link to={href} className="line-clamp-2 min-h-[2.1rem] text-[13px] font-semibold leading-tight hover:text-[var(--brand)]">
          {product.name}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0 leading-tight">
            <p className="font-display text-base font-bold tracking-tight">{formatCurrency(product.price)}</p>
            <p className="flex flex-wrap items-center gap-x-1.5 text-[10px]">
              {d ? <span className="text-white/45 line-through">{formatCurrency(product.compareAtPrice!)}</span> : null}
              <StockLine product={product} />
            </p>
          </div>
          <button
            type="button"
            onClick={add}
            aria-label={t('common.addToCart')}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow transition active:scale-95"
          >
            <SiteIcon name="cart" size={15} />
          </button>
        </div>
      </div>
    </article>
  )
}

/** Time each deal stays in view before the row moves on (phones). */
const PHONE_ROTATE_MS = 5000

/**
 * Phones / tablets: deal cards in a swipeable row (native scroll-snap, so swiping is smooth), with
 * dots. Moves on by itself while the hero is on screen; stops for good once the visitor touches it.
 */
export function HomeDealsStrips({ products }: { products: Product[] }) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const [touched, setTouched] = useState(false)
  const [onScreen, setOnScreen] = useState(true)
  const many = products.length > 1

  const step = () => {
    const el = scroller.current
    const child = el?.firstElementChild as HTMLElement | null
    return child ? child.offsetWidth + 10 : (el?.clientWidth ?? 0)
  }

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    setCurrent(Math.min(products.length - 1, Math.round(Math.abs(el.scrollLeft) / step())))
  }

  const goTo = (i: number) => {
    const el = scroller.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    el.scrollTo({ left: (rtl ? -1 : 1) * i * step(), behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  // Only move while the row is visible
  useEffect(() => {
    const el = scroller.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: 0.6 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!many || touched || !onScreen || reduceMotion) return
    const id = window.setTimeout(() => goTo((current + 1) % products.length), PHONE_ROTATE_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, many, touched, onScreen, reduceMotion, products.length])

  if (!many) return products[0] ? <DealMiniCard product={products[0]} /> : null

  return (
    <div aria-roledescription="carousel" aria-label={t('home.dealsLabel')}>
      <div
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={() => setTouched(true)}
        className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 pb-2 pt-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div key={p._id} className="w-[60%] max-w-[15rem] shrink-0 snap-start sm:w-[42%] sm:max-w-[17rem]">
            <DealMiniCard product={p} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-center gap-1.5">
        {products.map((p, i) => (
          <button
            key={p._id}
            type="button"
            onClick={() => {
              setTouched(true)
              goTo(i)
            }}
            aria-label={`${i + 1} / ${products.length}`}
            aria-current={i === current}
            className="flex h-6 items-center px-0.5"
          >
            <span
              className={cn(
                'block h-1.5 rounded-full transition-all duration-300',
                i === current ? 'w-6 bg-[var(--brand)]' : 'w-1.5 bg-[color-mix(in_srgb,var(--fg)_25%,transparent)] dark:bg-white/40'
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
