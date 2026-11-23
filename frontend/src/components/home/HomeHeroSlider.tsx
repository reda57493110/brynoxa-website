import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { SafeImage } from '@/components/ui/SafeImage'
import { ImageSpinner } from '@/components/ui/ImageLoader'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useImageLoaded } from '@/hooks/useImageLoaded'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, imageSrcSet, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { useLocaleStore } from '@/store/localeStore'
import type { Product } from '@/types'
import { DealSticker, StockLine, deal, keySpecs, useAddToCart } from './HomeSpotlight'

/** Time each deal stays on screen before the next one */
export const SLIDE_MS = 6000
/** After a deal is picked by hand, rotation carries on after this long */
const RESUME_AFTER_PICK_MS = 15000

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

/** The Brynoxa frame of the banner: a soft cyan glow (dark; light in light mode, see .ink) */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex h-full flex-col ink overflow-hidden rounded-[1.5rem] border border-[rgb(0_194_255/0.28)] bg-[#070a0d] text-white shadow-[0_30px_80px_-40px_rgb(0_194_255/0.55)] sm:rounded-[2rem]">
      <div
        className="ink-glow pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_80%_at_85%_40%,rgb(0_194_255/0.22),transparent_65%),radial-gradient(50%_70%_at_0%_100%,rgb(0_194_255/0.12),transparent_60%)]"
        aria-hidden="true"
      />
      {children}
    </div>
  )
}

/** One deal: text on one side, the product photo on the other (photo on top on phones) */
function Slide({ product, active, eager }: { product: Product; active: boolean; eager: boolean }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const src = sizedImageUrl(image, 1280)
  const photo = useImageLoaded<HTMLAnchorElement>(src)
  const contain = imageFit(image) === 'contain'
  const d = deal(product)
  const brand = typeof product.brand === 'object' ? product.brand?.name : undefined
  const specs = keySpecs(product, locale, 3)
  const href = `/product/${product.slug}`

  return (
    <article
      inert={!active}
      aria-hidden={!active}
      className={cn(
        'grid h-full grid-cols-[45%_minmax(0,1fr)] items-center gap-3 p-3 [grid-area:1/1] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-6 sm:p-8 lg:items-stretch lg:gap-6 lg:p-8',
        'transition-opacity ease-[cubic-bezier(0.4,0,0.2,1)]',
        active ? 'z-[1] opacity-100 duration-500' : 'pointer-events-none opacity-0 duration-300'
      )}
    >
      {/* Photo */}
      <Link
        to={href}
        tabIndex={-1}
        aria-hidden="true"
        ref={photo.ref}
        className={cn(
          'group relative block aspect-square overflow-hidden rounded-xl sm:order-2 sm:aspect-[5/4] sm:rounded-[1.4rem] lg:aspect-auto lg:h-full lg:min-h-[20rem]',
          contain ? 'photo-stage' : 'bg-[#0b1116]'
        )}
      >
        {photo.loaded ? null : <ImageSpinner size="lg" tone={contain ? 'auto' : 'dark'} />}
        {/* A photo (not a packshot on white): shown whole; a blurred copy fills the frame around it */}
        {!contain && src ? (
          <img
            src={src}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            decoding="async"
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-60 blur-2xl"
          />
        ) : null}
        <SafeImage
          src={src}
          srcSet={imageSrcSet(image, [640, 960, 1280, 1600])}
          sizes="(min-width: 1024px) 34rem, (min-width: 640px) 45vw, 92vw"
          alt=""
          width={1280}
          height={1024}
          referrerPolicy="no-referrer"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          onLoad={photo.onLoad}
          onError={photo.onError}
          className={cn(
            'absolute inset-0 h-full w-full transition duration-[900ms] ease-out group-hover:scale-[1.04]',
            contain ? 'object-contain p-2 mix-blend-multiply sm:p-3' : 'object-contain',
            active ? 'scale-100' : 'scale-[1.05]',
            photo.loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
        {d ? (
          <DealSticker percent={d.percent} className="absolute end-1.5 top-1.5 z-10 h-8 w-8 -rotate-6 text-[10px] sm:end-4 sm:top-4 sm:h-14 sm:w-14 sm:text-base" />
        ) : null}
      </Link>

      {/* Text */}
      <div className="@container min-w-0 sm:order-1 lg:self-center">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-5 items-center gap-1 rounded-full bg-[rgb(0_194_255/0.14)] px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--brand)] ring-1 ring-[rgb(0_194_255/0.35)] sm:h-8 sm:px-3 sm:text-xs">
            <SiteIcon name={d ? 'tag' : 'star'} size={13} solid={!d} />
            {d ? t('home.spotlightDeal') : t('product.featuredPick')}
          </span>
          {brand ? <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55 max-sm:hidden sm:text-xs">{brand}</span> : null}
        </div>

        <h2 className="text-white mt-1.5 line-clamp-2 font-display text-[15px] font-bold leading-tight tracking-tight sm:mt-4 sm:text-3xl lg:text-[2.2rem] lg:leading-[1.1]">
          <Link to={href} className="hover:text-[var(--brand-text)] focus-visible:outline-none focus-visible:underline">
            {product.name}
          </Link>
          {product.variantLabel ? <span className="font-medium text-white/60"> · {product.variantLabel}</span> : null}
        </h2>

        {specs.length ? (
          <ul className="mt-3 hidden flex-wrap gap-1.5 sm:mt-4 sm:flex sm:gap-2">
            {specs.map((s) => (
              <li
                key={s.key}
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-white/12 bg-white/[0.06] px-2 py-1 text-[11px] text-white/90 sm:px-2.5 sm:py-1.5 sm:text-[13px]"
              >
                <SiteIcon name={s.icon} size={13} className="shrink-0 text-[var(--brand)]" />
                <span className="truncate">{s.value}</span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-end gap-x-2 gap-y-0.5 sm:mt-6 sm:gap-x-3">
          <span className="whitespace-nowrap font-display text-xl font-extrabold leading-none tracking-tight text-[var(--brand)] sm:text-[2.6rem] lg:text-5xl">
            {formatCurrency(product.price)}
          </span>
          {d ? (
            <span className="whitespace-nowrap text-[11px] text-white/45 line-through sm:pb-0.5 sm:text-lg">{formatCurrency(product.compareAtPrice!)}</span>
          ) : null}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:mt-2 sm:gap-x-3 sm:text-xs">
          {d ? (
            <span className="inline-flex rounded-md bg-[rgb(0_194_255/0.16)] px-2 py-0.5 font-semibold text-[var(--brand-text)]">
              {t('home.spotlightSave', { amount: formatCurrency(d.saved) })}
            </span>
          ) : null}
          <StockLine product={product} />
        </div>

        <div className="mt-2.5 flex gap-2 sm:mt-7 sm:gap-3">
          <button
            type="button"
            onClick={add}
            className="btn-shine inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--brand)] px-3 text-xs font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:h-12 sm:flex-none sm:gap-2 sm:px-7 sm:text-base"
          >
            <SiteIcon name="cart" size={17} />
            {t('common.addToCart')}
          </button>
          <Link
            to={href}
            className="inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/20 bg-white/[0.04] px-4 text-sm font-semibold text-white max-sm:hidden transition hover:border-[var(--brand)] hover:text-[var(--brand)] sm:h-12 sm:px-6 sm:text-base"
          >
            <span className="max-sm:sr-only @max-[24rem]:sr-only">{t('product.viewProduct')}</span>
            <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </article>
  )
}

/** A shimmering bar standing in for a line of text */
function Bar({ className }: { className?: string }) {
  return (
    <span className={cn('relative block overflow-hidden rounded-full bg-white/10', className)} aria-hidden="true">
      <span className="absolute inset-y-0 start-0 w-2/3 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent motion-safe:animate-[image-shimmer_1.6s_ease-in-out_infinite] rtl:translate-x-full" />
    </span>
  )
}

/** While the deals load: the same banner, with a spinner and lines, so nothing jumps */
export function HomeHeroSliderSkeleton() {
  const t = useT()
  return (
    <Frame>
      <div className="grid h-full items-center gap-4 p-3.5 sm:grid-cols-2 sm:gap-6 sm:p-8 lg:p-10" role="status" aria-busy="true">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.1rem] bg-white/[0.04] sm:order-2 sm:aspect-[5/4] sm:rounded-[1.4rem]">
          <ImageSpinner size="lg" tone="dark" />
        </div>
        <div className="space-y-3 sm:order-1 sm:space-y-4">
          <Bar className="h-6 w-28" />
          <Bar className="h-7 w-11/12 sm:h-9" />
          <Bar className="h-7 w-3/5 sm:h-9" />
          <div className="flex gap-2">
            <Bar className="h-7 w-24" />
            <Bar className="h-7 w-20" />
          </div>
          <Bar className="h-10 w-40 sm:h-12" />
          <Bar className="h-11 w-full bg-[rgb(0_194_255/0.25)] sm:w-52" />
        </div>
        <span className="sr-only">{t('ui.loadingProducts')}</span>
      </div>
    </Frame>
  )
}

/**
 * Home banner: the home deals (Admin → Products → Home page) as a big rotating banner, one deal at
 * a time — name, key specs, price, Add to cart and the photo. Changes every 6 s; hovering, focusing
 * or picking a deal pauses it; swipe on phones; ‹ › and the bars underneath pick one.
 * All deals are rendered once and crossfaded (no reload, no height jump).
 */
export function HomeHeroSlider({ products }: { products: Product[] }) {
  const t = useT()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [picked, setPicked] = useState(false)
  const many = products.length > 1
  const active = Math.min(index, products.length - 1)
  const touch = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (index >= products.length) setIndex(0)
  }, [products.length, index])

  useEffect(() => {
    if (!many || paused) return
    const id = window.setTimeout(() => {
      setPicked(false)
      setIndex((i) => (i + 1) % products.length)
    }, picked ? RESUME_AFTER_PICK_MS : SLIDE_MS)
    return () => window.clearTimeout(id)
  }, [index, many, paused, picked, products.length])

  if (!products.length) return null

  const go = (delta: number) => {
    setIndex((i) => (i + delta + products.length) % products.length)
    setPicked(true)
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t('home.dealsLabel')}
      className="h-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Frame>
        <div
          className="relative grid flex-1 touch-pan-y"
          onTouchStart={(e) => {
            touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
          }}
          onTouchEnd={(e) => {
            const start = touch.current
            touch.current = null
            if (!start || !many) return
            const dx = e.changedTouches[0].clientX - start.x
            const dy = e.changedTouches[0].clientY - start.y
            if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
            const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
            go(dx < 0 !== rtl ? 1 : -1)
          }}
        >
          {products.map((p, i) => (
            <Slide key={p._id} product={p} active={i === active} eager={i === 0} />
          ))}
        </div>

        {many ? (
          <div className="relative z-10 flex items-center gap-3 px-3 pb-3 sm:px-8 sm:pb-6 lg:px-10">
            <div role="tablist" aria-label={t('home.dealsLabel')} className="flex flex-1 gap-1.5 sm:gap-2">
              {products.map((p, i) => {
                const on = i === active
                return (
                  <button
                    key={p._id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-label={p.name}
                    title={p.name}
                    onClick={() => {
                      setIndex(i)
                      setPicked(true)
                    }}
                    className={cn(
                      'group/bar relative h-6 flex-1 sm:flex sm:h-auto sm:max-w-[10rem] sm:items-center sm:gap-2 sm:overflow-hidden sm:rounded-xl sm:border sm:p-1.5 sm:pe-2.5 sm:text-start sm:transition',
                      on ? 'sm:border-[rgb(0_194_255/0.6)] sm:bg-[rgb(0_194_255/0.1)]' : 'sm:border-white/10 sm:bg-white/[0.03] sm:hover:border-white/30'
                    )}
                  >
                    {/* Computers / tablets: a small photo and the price */}
                    <span className={cn('relative hidden size-9 shrink-0 overflow-hidden rounded-lg sm:block', imageFit(primaryImage(p)) === 'contain' ? 'photo-stage' : 'bg-white/10')}>
                      {primaryImage(p) ? (
                        <SafeImage
                          src={sizedImageUrl(primaryImage(p), 120)}
                          alt=""
                          width={36}
                          height={36}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className={cn('h-full w-full', imageFit(primaryImage(p)) === 'contain' ? 'object-contain p-0.5 mix-blend-multiply' : 'object-cover')}
                        />
                      ) : null}
                    </span>
                    <span className={cn('hidden min-w-0 truncate text-xs font-bold sm:block', on ? 'text-white' : 'text-white/65')}>{formatCurrency(p.price)}</span>
                    <span
                      className={cn(
                        'absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full transition sm:inset-x-1.5 sm:bottom-1 sm:top-auto sm:h-0.5 sm:translate-y-0',
                        on ? 'bg-white/20' : 'bg-white/15 group-hover/bar:bg-white/35 sm:bg-transparent'
                      )}
                    >
                      {on ? (
                        <span
                          key={`${p._id}-${index}-${picked}`}
                          className={cn(
                            'absolute inset-0 origin-left rounded-full bg-[var(--brand)] rtl:origin-right',
                            picked ? '' : 'motion-safe:animate-[deal-progress_6s_linear_forwards]'
                          )}
                          style={{ animationPlayState: paused ? 'paused' : 'running' }}
                        />
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label={t('home.prevDeal')}
                className="grid size-8 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-white transition hover:border-[var(--brand)] hover:text-[var(--brand)] sm:size-10"
              >
                <SiteIcon name="chevron-left" size={16} className="rtl:rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label={t('home.nextDeal')}
                className="grid size-8 place-items-center rounded-full border border-white/15 bg-white/[0.05] text-white transition hover:border-[var(--brand)] hover:text-[var(--brand)] sm:size-10"
              >
                <SiteIcon name="chevron-right" size={16} className="rtl:rotate-180" />
              </button>
            </div>
          </div>
        ) : null}
      </Frame>
    </section>
  )
}
