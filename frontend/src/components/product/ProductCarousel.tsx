import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { Product } from '@/types'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/cn'
import { cardOffset, nearestCard } from '@/lib/carousel'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { SiteIcon } from '@/components/ui/SiteIcon'

const DRAG_THRESHOLD = 8
const AUTO_SPEED = 0.45
/** After ‹ › the automatic scroll waits this long, so the product stays in view */
const ARROW_HOLD_MS = 6000
/** Glide to a product in this long */
const GLIDE_MS = 380


function wrapOffset(value: number, half: number) {
  if (half <= 0) return value
  let next = value % half
  if (next > 0) next -= half
  if (next <= -half) next += half
  return next
}

/** `size="lg"`: bigger cards on tablets and computers (home New arrivals); `sm`: small cards, about two on a phone (Grab your setup) */
export function ProductCarousel({ products, size = 'md' }: { products: Product[]; size?: 'sm' | 'md' | 'lg' }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const trackRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const halfRef = useRef(0)
  const stepRef = useRef(0)
  const hoveringRef = useRef(false)
  const pausedRef = useRef(false)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startOffsetRef = useRef(0)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** A glide in progress (the automatic scroll waits) */
  const glideRef = useRef<number | null>(null)
  /** No automatic scroll until this time (after ‹ ›) */
  const holdUntilRef = useRef(0)
  const [paused, setPaused] = useState(false)

  // Always moves (the owner wants it); visitors can stop it with the Pause button
  const moving = products.length > 1
  const loop = products.length > 1 ? [...products, ...products] : products

  const paint = (value: number) => {
    const next = wrapOffset(value, halfRef.current)
    offsetRef.current = next
    const el = trackRef.current
    if (el) el.style.transform = `translate3d(${next}px,0,0)`
  }

  const clearResumeTimer = () => {
    if (resumeTimerRef.current) {
      clearTimeout(resumeTimerRef.current)
      resumeTimerRef.current = null
    }
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const measure = () => {
      // One product = its card + the gap after it (the last card has no gap after it, so add one)
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0
      stepRef.current = products.length > 1 ? (track.scrollWidth + gap) / loop.length : 0
      halfRef.current = stepRef.current * products.length
      paint(offsetRef.current)
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)

    // Re-measure after images settle (card widths can change)
    const imgs = track.querySelectorAll('img')
    imgs.forEach((img) => {
      if (!img.complete) img.addEventListener('load', measure, { once: true })
    })

    return () => {
      ro.disconnect()
      imgs.forEach((img) => img.removeEventListener('load', measure))
    }
  }, [products, loop.length, locale])

  useEffect(() => {
    offsetRef.current = 0
    paint(0)
  }, [locale])

  useEffect(() => {
    if (!moving) return
    let frame = 0
    const tick = () => {
      if (!pausedRef.current && !hoveringRef.current && !draggingRef.current && glideRef.current === null && performance.now() > holdUntilRef.current) {
        paint(offsetRef.current - AUTO_SPEED)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [moving])

  useEffect(
    () => () => {
      clearResumeTimer()
      if (glideRef.current !== null) cancelAnimationFrame(glideRef.current)
    },
    []
  )

  const sizes = () => {
    const track = trackRef.current
    const card = (track?.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0
    const viewport = track?.parentElement?.clientWidth ?? 0
    return { card, viewport, step: stepRef.current }
  }

  /** Glide smoothly to an offset (eased), then stay there */
  const glideTo = (target: number) => {
    if (glideRef.current !== null) cancelAnimationFrame(glideRef.current)
    const from = offsetRef.current
    const start = performance.now()
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      paint(target)
      glideRef.current = null
      return
    }
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / GLIDE_MS)
      const eased = 1 - Math.pow(1 - t, 3)
      // From → target as plain numbers; paint() wraps them into the loop
      paint(from + (target - from) * eased)
      if (t < 1) glideRef.current = requestAnimationFrame(frame)
      else glideRef.current = null
    }
    glideRef.current = requestAnimationFrame(frame)
  }

  /** Stop on a whole product (the nearest one), not half-way */
  const snapToNearest = () => {
    const { card, viewport, step } = sizes()
    if (!step) return
    glideTo(cardOffset(nearestCard(offsetRef.current, step, viewport, card), step, viewport, card))
  }

  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    draggingRef.current = false
    trackRef.current?.classList.remove('cursor-grabbing')
    trackRef.current?.classList.add('cursor-grab')

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (movedRef.current && (pausedRef.current || event.pointerType !== 'mouse')) snapToNearest()

    // Touch has no reliable hover — resume autoplay shortly after drag
    if (event.pointerType !== 'mouse') {
      clearResumeTimer()
      resumeTimerRef.current = setTimeout(() => {
        hoveringRef.current = false
      }, 400)
    } else if (!hoveringRef.current) {
      // mouse already left during drag
      hoveringRef.current = false
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (products.length < 2) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    clearResumeTimer()
    pointerIdRef.current = event.pointerId
    draggingRef.current = false
    movedRef.current = false
    startXRef.current = event.clientX
    startOffsetRef.current = offsetRef.current
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    const dx = event.clientX - startXRef.current

    if (!draggingRef.current) {
      if (Math.abs(dx) < DRAG_THRESHOLD) return
      draggingRef.current = true
      movedRef.current = true
      trackRef.current?.classList.add('cursor-grabbing')
      trackRef.current?.classList.remove('cursor-grab')
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        /* ignore */
      }
    }

    event.preventDefault()
    paint(startOffsetRef.current + dx)
  }

  /** ‹ / ›: exactly one product, landing on it (centred on phones) */
  const moveByCard = (direction: number) => {
    const { card, viewport, step } = sizes()
    if (!step) {
      paint(offsetRef.current + direction * 304)
      return
    }
    holdUntilRef.current = performance.now() + ARROW_HOLD_MS
    const i = nearestCard(offsetRef.current, step, viewport, card) - direction
    glideTo(cardOffset(i, step, viewport, card))
  }

  return (
    <div
      dir="ltr"
      className="relative overflow-hidden py-1"
      role="region"
      aria-roledescription="carousel"
      aria-label={t('home.featuredProducts')}
      // Only a real mouse pauses it while over it: a phone tap would count as 'hovering' forever
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') hoveringRef.current = true
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') hoveringRef.current = false
      }}
    >
      <div
        ref={trackRef}
        dir="ltr"
        className={cn(
          'flex w-max cursor-grab flex-row gap-4 select-none',
          'touch-pan-y will-change-transform'
        )}
        style={{ transform: 'translate3d(0px,0,0)' }}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault()
            moveByCard(1)
          } else if (event.key === 'ArrowRight') {
            event.preventDefault()
            moveByCard(-1)
          } else if (event.key === 'Home') {
            event.preventDefault()
            paint(0)
          } else if (event.key === 'End') {
            event.preventDefault()
            paint(-halfRef.current + (stepRef.current || 304))
          }
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onClickCapture={(event) => {
          if (!movedRef.current) return
          event.preventDefault()
          event.stopPropagation()
          movedRef.current = false
        }}
      >
        {loop.map((product, i) => (
          <div
            key={`${product._id}-${i}`}
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            className={size === 'lg' ? 'relative w-[min(14rem,62vw)] shrink-0 sm:w-[21.5rem]' : size === 'sm' ? 'relative w-[min(11.5rem,48vw)] shrink-0 sm:w-[15rem]' : 'relative w-[min(14rem,62vw)] shrink-0 sm:w-[18.5rem]'}
            aria-hidden={i >= products.length ? true : undefined}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => moveByCard(1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          aria-label={t('home.previousFeatured')}
        >
          <SiteIcon name="chevron-left" size={15} />
        </button>
        <button
          type="button"
          onClick={() => moveByCard(-1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          aria-label={t('home.nextFeatured')}
        >
          <SiteIcon name="chevron-right" size={15} />
        </button>
        {moving ? (
          <button
            type="button"
            onClick={() => {
              const next = !paused
              pausedRef.current = next
              setPaused(next)
              // Paused: stop on a whole product, not half-way
              if (next) snapToNearest()
            }}
            className="rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
            aria-pressed={paused}
          >
            {paused ? t('home.resumeFeatured') : t('home.pauseFeatured')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
