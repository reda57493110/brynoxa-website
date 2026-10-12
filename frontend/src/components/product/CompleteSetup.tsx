import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { ProductCard } from '@/components/product/ProductCard'
import { useAddToCart } from '@/components/home/HomeSpotlight'
import { LoadingImage } from '@/components/ui/ImageLoader'
import { Skeleton } from '@/components/ui/Skeleton'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { useLocaleStore } from '@/store/localeStore'
import type { Product } from '@/types'

const cardWidth = 'shrink-0 snap-start sm:w-[13.5rem] lg:w-[14.5rem]'
const arrowBtn =
  'hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:inline-flex'

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

/** Phone card: square photo with a one-tap add button, discount tag, 2-line name and price. */
function SetupMiniCard({ product }: { product: Product }) {
  const t = useT()
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const contain = imageFit(image) === 'contain'
  const off =
    product.compareAtPrice != null && product.compareAtPrice > product.price
      ? Math.round((1 - product.price / product.compareAtPrice) * 100)
      : null
  const href = `/product/${product.slug}`
  const soldOut = product.stock <= 0

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] transition active:scale-[0.98]">
      <div className={cn('relative aspect-square', contain ? 'bg-white' : 'bg-[var(--bg-muted)]')}>
        <Link to={href} className="absolute inset-0" aria-label={product.name}>
          {image ? (
            <LoadingImage
              src={sizedImageUrl(image, 360)}
              alt=""
              width={180}
              height={180}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              spinnerSize="sm"
              frameClassName="absolute inset-0"
              className={cn('h-full w-full', contain ? 'object-contain p-2 mix-blend-multiply' : 'object-cover')}
            />
          ) : null}
        </Link>
        {off ? (
          <span className="pointer-events-none absolute start-1.5 top-1.5 rounded-md bg-[var(--brand)] px-1.5 text-[10px] font-bold leading-5 text-[var(--brand-fg)]">
            -{off}%
          </span>
        ) : null}
        <button
          type="button"
          onClick={add}
          disabled={soldOut}
          aria-label={t('common.addToCart')}
          className="absolute bottom-1.5 end-1.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow transition active:scale-90 disabled:opacity-40"
        >
          <SiteIcon name="cart" size={14} />
          <SiteIcon name="plus" size={9} className="absolute end-1 top-1" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <Link to={href} className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-tight text-[var(--fg)]">
          {product.name}
        </Link>
        <p className="mt-auto flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[13px] font-bold tabular-nums text-[var(--fg)]">{formatCurrency(product.price)}</span>
          {off ? (
            <span className="text-[10px] tabular-nums text-[var(--fg-muted)] line-through">{formatCurrency(product.compareAtPrice!)}</span>
          ) : null}
        </p>
        {soldOut ? <p className="text-[10px] font-medium text-[var(--danger)]">{t('stock.outOfStock')}</p> : null}
      </div>
    </article>
  )
}

/** Complementary products for the product being viewed (hidden when there are none). */
export function CompleteSetup({ productId }: { productId: string }) {
  const t = useT()
  const rtl = useLocaleStore((s) => s.locale) === 'ar'
  const rowRef = useRef<HTMLDivElement>(null)
  const phoneRowRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [progress, setProgress] = useState({ size: 1, start: 0 })

  const recommendations = useQuery({
    queryKey: ['products', 'recommendations', productId],
    queryFn: async () => (await productsApi.recommendations(productId)).data.data,
    staleTime: 5 * 60_000,
  })

  // Arrows only when the row is wider than the screen
  const count = recommendations.data?.length ?? 0
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const measure = () => setOverflowing(row.scrollWidth > row.clientWidth + 4)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [count])

  // Phone scroll indicator: visible share of the row and where it sits
  const updateProgress = () => {
    const row = phoneRowRef.current
    if (!row || !row.scrollWidth) return
    const size = Math.min(1, row.clientWidth / row.scrollWidth)
    const max = row.scrollWidth - row.clientWidth
    const start = max > 0 ? (Math.abs(row.scrollLeft) / max) * (1 - size) : 0
    setProgress({ size, start })
  }
  useEffect(() => {
    updateProgress()
  }, [count])

  if (recommendations.isError || (recommendations.data && !recommendations.data.length)) return null

  const scroll = (direction: 1 | -1) => {
    const row = rowRef.current
    if (!row) return
    row.scrollBy({ left: direction * (rtl ? -1 : 1) * row.clientWidth * 0.85, behavior: 'smooth' })
  }

  return (
    <section
      aria-labelledby="complete-setup-heading"
      className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-soft sm:mt-8 sm:rounded-[1.35rem] sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/15 text-[var(--brand-text)] sm:hidden">
            <SiteIcon name="layers" size={15} />
          </span>
          <div className="min-w-0">
            <h2
              id="complete-setup-heading"
              className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-[var(--fg)] sm:text-xl"
            >
              {t('productPage.completeSetup')}
              {count ? (
                <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)] sm:hidden">
                  {count}
                </span>
              ) : null}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)] sm:text-sm">{t('productPage.completeSetupBody')}</p>
          </div>
        </div>
        <div className={overflowing ? 'flex gap-2' : 'hidden'}>
          <button type="button" className={arrowBtn} onClick={() => scroll(-1)} aria-label={t('productPage.scrollBack')}>
            <SiteIcon name="chevron-left" size={18} className="rtl:rotate-180" />
          </button>
          <button type="button" className={arrowBtn} onClick={() => scroll(1)} aria-label={t('productPage.scrollForward')}>
            <SiteIcon name="chevron-right" size={18} className="rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Phones: compact cards, ~2.5 per screen, with a scroll indicator */}
      <div className="sm:hidden">
        <div
          ref={phoneRowRef}
          onScroll={updateProgress}
          className="-mx-3 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3 px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {recommendations.data
            ? recommendations.data.map((product) => (
                <div key={product._id} className="w-[36vw] max-w-[9.5rem] shrink-0 snap-start">
                  <SetupMiniCard product={product} />
                </div>
              ))
            : Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} spinner className="aspect-[3/4.2] w-[36vw] max-w-[9.5rem] shrink-0 rounded-xl ring-0" />
              ))}
        </div>
        {progress.size < 1 ? (
          <div className="mx-auto mt-2 h-1 w-16 overflow-hidden rounded-full bg-[var(--bg-muted)]" aria-hidden="true">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-transform duration-150 ease-out rtl:origin-right"
              style={{
                width: `${progress.size * 100}%`,
                transform: `translateX(${(rtl ? -1 : 1) * (progress.start / progress.size) * 100}%)`,
              }}
            />
          </div>
        ) : null}
      </div>

      {/* Tablet / desktop: the regular product cards */}
      <div
        ref={rowRef}
        className="mt-3 hidden snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden"
      >
        {recommendations.data
          ? recommendations.data.map((product) => (
              <div key={product._id} className={cardWidth}>
                <ProductCard product={product} />
              </div>
            ))
          : Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className={`${cardWidth} aspect-[3/4] rounded-[var(--radius-card)] ring-0`} />
            ))}
      </div>
    </section>
  )
}
