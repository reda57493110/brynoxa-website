import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { SafeImage } from '@/components/ui/SafeImage'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import type { Product } from '@/types'
import { HomeSpotlightCard, HomeSpotlightStrip } from './HomeSpotlight'

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

/** Phones / tablets: deals as a swipeable row of strips, with dots. */
export function HomeDealsStrips({ products }: { products: Product[] }) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  const many = products.length > 1

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const child = el.firstElementChild as HTMLElement | null
    const step = child ? child.offsetWidth + 12 : el.clientWidth
    setCurrent(Math.min(products.length - 1, Math.round(Math.abs(el.scrollLeft) / step)))
  }

  const goTo = (i: number) => {
    const el = scroller.current
    const child = el?.children[i] as HTMLElement | undefined
    child?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }

  if (!many) return products[0] ? <HomeSpotlightStrip product={products[0]} /> : null

  return (
    <div aria-roledescription="carousel" aria-label={t('home.dealsLabel')}>
      <div
        ref={scroller}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 [scrollbar-width:none] sm:-mx-6 sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <div key={p._id} className="w-[88%] max-w-md shrink-0 snap-start">
            <HomeSpotlightStrip product={p} />
          </div>
        ))}
      </div>
      <div className="mt-2.5 flex justify-center gap-1.5">
        {products.map((p, i) => (
          <button
            key={p._id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`${i + 1} / ${products.length}`}
            aria-current={i === current}
            className={cn('h-1.5 rounded-full transition-all', i === current ? 'w-5 bg-[var(--brand)]' : 'w-1.5 bg-[color-mix(in_srgb,var(--fg)_25%,transparent)] dark:bg-white/40')}
          />
        ))}
      </div>
    </div>
  )
}
