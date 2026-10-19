import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { useAddToCart } from '@/components/home/HomeSpotlight'
import { LoadingImage } from '@/components/ui/ImageLoader'
import { Skeleton } from '@/components/ui/Skeleton'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { SETUP_KIND_KEYS, type SetupKind } from '@/lib/setupKinds'
import { cn } from '@/lib/cn'
import { useLocaleStore } from '@/store/localeStore'
import type { Product } from '@/types'

const MAX_SHOWN = 8

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

/** One suggestion: photo, what it is ("Mouse"), name, price and a one-tap add. Same card on every screen. */
function SetupCard({ product }: { product: Product }) {
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
  const kindKey = product.setupKind ? SETUP_KIND_KEYS[product.setupKind as SetupKind] : undefined

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] transition hover:border-[var(--brand)] sm:rounded-2xl">
      <Link
        to={href}
        className={cn('relative block aspect-square overflow-hidden', contain ? 'bg-white' : 'bg-[var(--bg-muted)]')}
        aria-label={product.name}
      >
        {image ? (
          <LoadingImage
            src={sizedImageUrl(image, 400)}
            alt=""
            width={200}
            height={200}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            spinnerSize="sm"
            frameClassName="absolute inset-0"
            className={cn(
              'h-full w-full transition duration-300 group-hover:scale-[1.03]',
              contain ? 'object-contain p-3 mix-blend-multiply' : 'object-cover'
            )}
          />
        ) : null}
        {off ? (
          <span className="pointer-events-none absolute end-1.5 top-1.5 rounded-md bg-[var(--brand)] px-1.5 text-[10px] font-bold leading-5 text-[var(--brand-fg)]">
            -{off}%
          </span>
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        {kindKey ? (
          <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--brand-text)] sm:text-[10px]">{t(kindKey)}</p>
        ) : null}
        <Link
          to={href}
          className="mt-0.5 line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-tight text-[var(--fg)] hover:text-[var(--brand-text)] sm:min-h-[2.5rem] sm:text-sm sm:leading-snug"
        >
          {product.name}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <p className="min-w-0">
            <span className="block text-[13px] font-bold tabular-nums text-[var(--fg)] sm:text-base">{formatCurrency(product.price)}</span>
            {off ? (
              <span className="block text-[10px] tabular-nums text-[var(--fg-muted)] line-through sm:text-xs">
                {formatCurrency(product.compareAtPrice!)}
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={add}
            disabled={soldOut}
            aria-label={`${t('common.addToCart')}: ${product.name}`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--brand)] text-sm font-semibold text-[var(--brand-fg)] transition hover:brightness-110 active:scale-95 disabled:opacity-40 sm:h-9 sm:w-auto sm:px-3.5"
          >
            <SiteIcon name="cart" size={14} />
            <span className="hidden sm:inline">{t('common.add')}</span>
          </button>
        </div>
      </div>
    </article>
  )
}

/**
 * Accessories that complete the product being viewed (a mouse and a bag for a laptop, cables and an
 * arm for a monitor…), chosen by the API. Hidden when there are none.
 */
export function CompleteSetup({ productId }: { productId: string }) {
  const t = useT()
  const rtl = useLocaleStore((s) => s.locale) === 'ar'
  const phoneRowRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState({ size: 1, start: 0 })

  const recommendations = useQuery({
    queryKey: ['products', 'recommendations', productId],
    queryFn: async () => (await productsApi.recommendations(productId)).data.data,
    staleTime: 5 * 60_000,
  })
  const items = (recommendations.data ?? []).slice(0, MAX_SHOWN)
  const count = items.length

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

  return (
    <section
      aria-labelledby="complete-setup-heading"
      className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 shadow-soft sm:mt-8 sm:rounded-[1.35rem] sm:p-6"
    >
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/15 text-[var(--brand-text)] sm:h-10 sm:w-10 sm:rounded-xl">
          <SiteIcon name="layers" size={16} />
        </span>
        <div className="min-w-0">
          <h2
            id="complete-setup-heading"
            className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight text-[var(--fg)] sm:text-xl"
          >
            {t('productPage.completeSetup')}
            {count ? (
              <span className="rounded-full bg-[var(--bg-muted)] px-1.5 text-[10px] font-semibold tabular-nums text-[var(--fg-muted)] sm:text-xs">
                {count}
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)] sm:text-sm">{t('productPage.completeSetupBody')}</p>
        </div>
      </div>

      {/* Phones: a swipeable row (~2.5 cards per screen) with a scroll indicator */}
      <div className="sm:hidden">
        <div
          ref={phoneRowRef}
          onScroll={updateProgress}
          className="-mx-3 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-px-3 px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {recommendations.data
            ? items.map((product) => (
                <div key={product._id} className="w-[38vw] max-w-[10rem] shrink-0 snap-start">
                  <SetupCard product={product} />
                </div>
              ))
            : Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} spinner className="aspect-[3/4.4] w-[38vw] max-w-[10rem] shrink-0 rounded-xl ring-0" />
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

      {/* Tablet / desktop: a tidy grid, up to two rows of four */}
      <div className="mt-4 hidden gap-3 sm:grid sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {recommendations.data
          ? items.map((product) => <SetupCard key={product._id} product={product} />)
          : Array.from({ length: 4 }, (_, i) => <Skeleton key={i} spinner className="aspect-[3/4.2] rounded-2xl ring-0" />)}
      </div>
    </section>
  )
}
