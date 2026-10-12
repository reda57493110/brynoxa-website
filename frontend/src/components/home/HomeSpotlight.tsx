import type { ReactNode } from 'react'
import { ImageSpinner, LoadingImage } from '@/components/ui/ImageLoader'
import { Link } from 'react-router-dom'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { useImageLoaded } from '@/hooks/useImageLoaded'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, imageSrcSet, sizedImageUrl } from '@/lib/image'
import { formatSpecValue, getTemplate, resolveTemplate } from '@/lib/specs'
import { cn } from '@/lib/cn'
import { useCartStore } from '@/store/cartStore'
import { useLocaleStore } from '@/store/localeStore'
import { toast } from '@/store/toastStore'
import type { Category, Product } from '@/types'

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

const SPEC_ICON: Record<string, SiteIconName> = {
  cpu: 'cpu',
  ram_gb: 'layers',
  capacity_gb: 'layers',
  storage: 'boxes',
  gpu: 'gamepad',
  screen_size: 'monitor',
  resolution: 'monitor',
  refresh_rate: 'monitor',
}

/** Up to `max` headline specs (the template's important ones, in order), formatted for display. */
function keySpecs(p: Product, locale: ReturnType<typeof useLocaleStore.getState>['locale'], max = 3) {
  const category = typeof p.category === 'object' ? (p.category as Category) : null
  const tpl = getTemplate(resolveTemplate(p.specTemplate, category))
  const specs = p.specs || {}
  return tpl.important
    .filter((k) => String(specs[k] ?? '').trim())
    .slice(0, max)
    .map((k) => ({ key: k, icon: SPEC_ICON[k] ?? 'sliders', value: formatSpecValue(k, String(specs[k]), locale) }))
}

export function useAddToCart(product: Product) {
  const addItem = useCartStore((s) => s.addItem)
  const t = useT()
  return () => {
    if (product.stock <= 0) {
      toast.error(t('product.outOfStock'))
      return
    }
    addItem({
      productId: product._id,
      slug: product.slug,
      name: product.variantLabel ? `${product.name} (${product.variantLabel})` : product.name,
      image: primaryImage(product),
      price: product.price,
      stock: product.stock,
      sku: product.sku,
      condition: product.condition,
    })
    toast.success(t('product.addedToCart'))
  }
}

export function deal(p: Product) {
  if (p.compareAtPrice == null || p.compareAtPrice <= p.price) return null
  return { percent: Math.round((1 - p.price / p.compareAtPrice) * 100), saved: p.compareAtPrice - p.price }
}

const isLow = (p: Product) => p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5)

/** "−14%" sticker in the brand colour. */
function DealSticker({ percent, className }: { percent: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-[var(--brand)] font-display font-bold text-[var(--brand-fg)] shadow-glow ring-4 ring-[#0b1116]',
        className
      )}
    >
      −{percent}%
    </span>
  )
}

/** Pulsing dot + "Only 3 left" / "In stock". */
export function StockLine({ product, className }: { product: Product; className?: string }) {
  const t = useT()
  const low = isLow(product)
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', low ? 'text-[#ffc53d]' : 'text-[#3dd68c]', className)}>
      <span className="relative flex h-2 w-2">
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping', low ? 'bg-[#ffc53d]' : 'bg-[#3dd68c]')} />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', low ? 'bg-[#ffc53d]' : 'bg-[#3dd68c]')} />
      </span>
      {low ? t('stock.onlyLeft', { count: product.stock }) : t('stock.inStock')}
    </span>
  )
}

/**
 * The glowing frame around the spotlight (float, halo, rotating border light, deal sticker).
 * Rendered once; the products inside it change without rebuilding it.
 */
function SpotlightShell({ products, active, children }: { products: Product[]; active: number; children: ReactNode }) {
  return (
    <div className="relative will-change-transform motion-safe:animate-[spotlight-float_7s_ease-in-out_infinite]">
      {/* Halo */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-[radial-gradient(closest-side,rgb(0_170_230/0.16),transparent)] dark:bg-[radial-gradient(closest-side,rgb(0_194_255/0.4),transparent)]"
        aria-hidden="true"
      />

      {/* One sticker per deal, crossfaded with the product */}
      {products.map((p, i) => {
        const d = deal(p)
        return d ? (
          <DealSticker
            key={p._id}
            percent={d.percent}
            className={cn(
              'absolute -end-5 -top-5 z-20 h-20 w-20 text-xl transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
              i === active ? 'rotate-12 scale-100 opacity-100' : 'pointer-events-none rotate-0 scale-75 opacity-0'
            )}
          />
        ) : null
      })}

      {/* Rotating light on the border */}
      <div className="group relative overflow-hidden rounded-[1.6rem] p-[1.5px] shadow-[0_28px_60px_-26px_rgb(15_23_42/0.5)] transition duration-300 hover:-translate-y-1 dark:shadow-[0_30px_80px_-24px_rgb(0_0_0/0.8)]">
        <div
          className="absolute inset-[-60%] bg-[conic-gradient(from_0deg,transparent_0deg,var(--brand)_70deg,transparent_140deg,transparent_200deg,rgb(122_223_255/0.7)_260deg,transparent_320deg)] will-change-transform motion-safe:animate-[spotlight-spin_9s_linear_infinite]"
          aria-hidden="true"
        />
        {/* Products stacked in the same cell: the frame keeps the tallest height, so it never jumps */}
        <div className="relative grid">{children}</div>
      </div>
    </div>
  )
}

/** One product inside the spotlight frame. Inactive ones stay rendered (photo already loaded), hidden. */
function SpotlightArticle({ product, active = true }: { product: Product; active?: boolean }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const src = sizedImageUrl(image, 1280)
  const photo = useImageLoaded(src)
  const contain = imageFit(image) === 'contain'
  const d = deal(product)
  const brand = typeof product.brand === 'object' ? product.brand?.name : undefined
  const specs = keySpecs(product, locale)
  const href = `/product/${product.slug}`

  return (
    <article
      inert={!active}
      aria-hidden={!active}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-[1.5rem] bg-[#0b1116] text-white [grid-area:1/1] transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform]',
        active ? 'z-[1] translate-x-0 scale-100 opacity-100' : 'pointer-events-none translate-x-4 scale-[0.985] opacity-0 rtl:-translate-x-4'
      )}
    >
      <div
        ref={photo.ref}
        className={cn(
          // Grows to fill the frame when this deal has less text than the others
          'relative isolate aspect-[4/3] flex-1 overflow-hidden [@media(max-height:820px)]:aspect-[16/10]',
          contain ? 'bg-white' : 'bg-[#0b1116]'
        )}
      >
        {photo.loaded ? null : <ImageSpinner size="lg" tone={contain ? 'auto' : 'dark'} />}
        <SafeImage
          src={src}
          srcSet={imageSrcSet(image, [640, 960, 1280, 1600])}
          sizes="(min-width: 1280px) 34rem, 30rem"
          alt=""
          width={1280}
          height={960}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          onLoad={photo.onLoad}
          onError={photo.onError}
          className={cn(
            'absolute inset-0 -z-10 h-full w-full max-w-none transition duration-700 ease-out group-hover:scale-[1.05]',
            // Packshots on white: whole product visible, clear of the fade; mix-blend-multiply
            // melts the photo's own off-white background into the card
            contain ? 'object-contain px-6 pb-12 pt-10 mix-blend-multiply' : 'object-cover',
            photo.loaded ? 'opacity-100' : 'opacity-0'
          )}
        />

        {/* Whole picture opens the product; buttons below stay clickable */}
        <Link to={href} className="absolute inset-0 z-0" aria-label={product.name} />

        <span className="pointer-events-none absolute start-4 top-4 z-10 inline-flex h-8 items-center gap-1.5 rounded-full bg-[#0b1116]/80 px-3 text-xs font-semibold">
          <SiteIcon name="star" size={13} solid className="text-[var(--brand)]" />
          {d ? t('home.spotlightDeal') : t('product.featuredPick')}
        </span>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#0b1116] to-transparent" aria-hidden="true" />
      </div>

      <div className="relative z-10 -mt-6 space-y-3 p-5 pt-0">
        <div className="min-w-0">
          {brand ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">{brand}</p> : null}
          <p className="mt-1 line-clamp-2 font-display text-xl font-semibold leading-snug drop-shadow xl:text-2xl">
            {product.name}
            {product.variantLabel ? <span className="font-normal text-white/65"> · {product.variantLabel}</span> : null}
          </p>
          {specs.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {specs.map((s) => (
                <li
                  key={s.key}
                  className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md border border-white/15 bg-white/[0.07] px-2 py-1 text-[11px] text-white/90"
                >
                  <SiteIcon name={s.icon} size={12} className="shrink-0 text-[var(--brand)]" />
                  <span className="truncate">{s.value}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="leading-tight">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-[2rem] font-bold tracking-tight xl:text-[2.25rem]">{formatCurrency(product.price)}</span>
              {d ? <span className="text-base text-white/50 line-through">{formatCurrency(product.compareAtPrice!)}</span> : null}
            </p>
            {d ? (
              <p className="mt-1 inline-flex rounded-md bg-[var(--brand)]/20 px-2 py-0.5 text-xs font-semibold text-[#7adfff]">
                {t('home.spotlightSave', { amount: formatCurrency(d.saved) })}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5 text-end text-xs">
            <StockLine product={product} className="justify-end" />
            <p className="flex items-center justify-end gap-1 text-white/65">
              <SiteIcon name="banknote" size={12} />
              {t('deposit.payOnDelivery')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={add}
            className="relative inline-flex h-12 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--brand)] px-5 text-base font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {/* Shine only on the visible deal (hidden ones stay idle) */}
            {active ? (
              <span
                className="pointer-events-none absolute inset-y-0 start-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent motion-safe:animate-[spotlight-shine_3.2s_ease-in-out_infinite]"
                aria-hidden="true"
              />
            ) : null}
            <SiteIcon name="cart" size={16} />
            {t('common.addToCart')}
          </button>
          <Link
            to={href}
            aria-label={t('product.viewProduct')}
            title={t('product.viewProduct')}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
          >
            <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </article>
  )
}

/**
 * Desktop spotlight. With several products (home deals) all of them are rendered once and the
 * visible one is crossfaded — no remount, no photo reload, no height jump.
 */
export function HomeSpotlightCard({ product, products, active = 0 }: { product?: Product; products?: Product[]; active?: number }) {
  const list = products ?? (product ? [product] : [])
  return (
    <SpotlightShell products={list} active={active}>
      {list.map((p, i) => (
        <SpotlightArticle key={p._id} product={p} active={i === active} />
      ))}
    </SpotlightShell>
  )
}

/** Phones and tablets: a glowing strip under the hero buttons (keeps them above the fold). */
export function HomeSpotlightStrip({ product }: { product: Product }) {
  const t = useT()
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const contain = imageFit(image) === 'contain'
  const d = deal(product)

  return (
    <div className="relative overflow-hidden rounded-2xl p-px shadow-[0_16px_40px_-16px_rgb(0_194_255/0.55)]">
      <div
        className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,var(--brand)_70deg,transparent_140deg,transparent_200deg,rgb(122_223_255/0.7)_260deg,transparent_320deg)] motion-safe:animate-[spotlight-spin_9s_linear_infinite]"
        aria-hidden="true"
      />
      <div className="relative flex min-w-0 items-center gap-3 rounded-[15px] bg-[#0b1116] p-2.5 pe-3 text-white">
        <Link to={`/product/${product.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={cn(
              'relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl',
              contain ? 'bg-[radial-gradient(circle_at_50%_40%,#ffffff,#e9eef3)]' : 'bg-white/10'
            )}
          >
            {image ? (
              <LoadingImage
                src={sizedImageUrl(image, 200)}
                alt=""
                width={80}
                height={80}
                loading="eager"
                referrerPolicy="no-referrer"
                spinnerSize="sm"
                frameClassName="h-full w-full"
                className={cn('h-full w-full', contain ? 'object-contain p-1' : 'object-cover')}
              />
            ) : (
              <SiteIcon name="package" size={18} />
            )}
            {d ? (
              <span className="absolute bottom-0.5 start-0.5 rounded-md bg-[var(--brand)] px-1.5 text-[11px] font-bold leading-5 text-[var(--brand-fg)]">
                −{d.percent}%
              </span>
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand)]">
              <SiteIcon name="star" size={10} solid />
              {d ? t('home.spotlightDeal') : t('product.featuredPick')}
            </span>
            <span className="line-clamp-2 text-[15px] font-semibold leading-snug">{product.name}</span>
            <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-sm">
              <span className="text-base font-bold">{formatCurrency(product.price)}</span>
              {d ? <span className="text-[11px] text-white/50 line-through">{formatCurrency(product.compareAtPrice!)}</span> : null}
              {isLow(product) ? <StockLine product={product} className="text-[11px]" /> : null}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={add}
          aria-label={t('common.addToCart')}
          className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <SiteIcon name="cart" size={17} />
        </button>
      </div>
    </div>
  )
}

/** Same footprint as the card while the product loads, so the hero does not jump. */
export function HomeSpotlightSkeleton({ strip }: { strip?: boolean }) {
  return strip ? (
    <div className="relative aspect-[4/3.4] w-[78%] max-w-[20rem] overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-muted)] dark:border-white/10 dark:bg-white/10">
      <ImageSpinner size="sm" tone="dark" />
    </div>
  ) : (
    <div className="relative aspect-square overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/10 [@media(max-height:820px)]:aspect-[5/4]">
      <ImageSpinner size="lg" tone="dark" />
    </div>
  )
}
