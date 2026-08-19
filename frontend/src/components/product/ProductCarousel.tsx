import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { Product } from '@/types'
import { ProductCard } from './ProductCard'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'

const DRAG_THRESHOLD = 10

function wrapOffset(value: number, half: number) {
  if (half <= 0) return value
  let next = value
  while (next <= -half) next += half
  while (next > 0) next -= half
  return next
}

export function ProductCarousel({ products }: { products: Product[] }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const reduceMotion = useReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const halfRef = useRef(0)
  const pausedRef = useRef(false)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const startXRef = useRef(0)
  const startOffsetRef = useRef(0)
  const [dragging, setDragging] = useState(false)

  const moving = !reduceMotion && products.length > 1
  const loop = products.length > 1 ? [...products, ...products] : products

  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      halfRef.current = products.length > 1 ? track.scrollWidth / 2 : 0
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(track)
    return () => ro.disconnect()
  }, [products.length, loop.length, locale])

  useEffect(() => {
    offsetRef.current = 0
    trackRef.current?.style.setProperty('transform', 'translate3d(0px,0,0)')
  }, [locale])

  useEffect(() => {
    if (!moving) return
    let frame = 0
    const speed = 0.55
    const tick = () => {
      if (!pausedRef.current && !draggingRef.current) {
        offsetRef.current = wrapOffset(offsetRef.current - speed, halfRef.current)
        trackRef.current?.style.setProperty('transform', `translate3d(${offsetRef.current}px,0,0)`)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [moving])

  const applyOffset = (value: number) => {
    offsetRef.current = wrapOffset(value, halfRef.current)
    trackRef.current?.style.setProperty('transform', `translate3d(${offsetRef.current}px,0,0)`)
  }

  const endPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== event.pointerId) return
    pointerIdRef.current = null
    draggingRef.current = false
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (products.length < 2) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
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
      pausedRef.current = true
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    applyOffset(startOffsetRef.current + dx)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    endPointer(event)
  }

  return (
    <div
      dir="ltr"
      className="relative overflow-hidden py-1"
      onMouseEnter={() => {
        pausedRef.current = true
      }}
      onMouseLeave={() => {
        pausedRef.current = false
      }}
    >
      <div
        ref={trackRef}
        dir="ltr"
        className={cn(
          'flex w-max flex-row gap-4 select-none touch-pan-y',
          dragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        role="region"
        aria-roledescription="carousel"
        aria-label={t('home.featuredProducts')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
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
