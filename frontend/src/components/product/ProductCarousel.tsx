import { useEffect, useRef, type PointerEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { Product } from '@/types'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'

const DRAG_THRESHOLD = 8
const AUTO_SPEED = 0.45

function wrapOffset(value: number, half: number) {
  if (half <= 0) return value
  let next = value % half
  if (next > 0) next -= half
  if (next <= -half) next += half
  return next
}

export function ProductCarousel({ products }: { products: Product[] }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const reduceMotion = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const halfRef = useRef(0)
  const hoveringRef = useRef(false)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startOffsetRef = useRef(0)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const moving = !reduceMotion && products.length > 1
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
      halfRef.current = products.length > 1 ? track.scrollWidth / 2 : 0
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
      if (!hoveringRef.current && !draggingRef.current) {
        paint(offsetRef.current - AUTO_SPEED)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [moving])

  useEffect(() => () => clearResumeTimer(), [])

  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    draggingRef.current = false
    trackRef.current?.classList.remove('cursor-grabbing')
    trackRef.current?.classList.add('cursor-grab')

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

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

  return (
    <div
      dir="ltr"
      className="relative overflow-hidden py-1"
      onMouseEnter={() => {
        hoveringRef.current = true
      }}
      onMouseLeave={() => {
        hoveringRef.current = false
        if (!draggingRef.current) return
        // If mouse leaves while still holding, keep drag until pointerup on window
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
        role="region"
        aria-roledescription="carousel"
        aria-label={t('home.featuredProducts')}
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
            className="relative w-[min(18.5rem,82vw)] shrink-0 sm:w-[18.5rem]"
            aria-hidden={i >= products.length ? true : undefined}
          >
            <ProductCard product={product} />
          </div>
        ))}
      </div>
    </div>
  )
}
