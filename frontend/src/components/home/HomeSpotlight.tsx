import type { ReactNode } from 'react'
import { ImageSpinner } from '@/components/ui/ImageLoader'
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
export function keySpecs(p: Product, locale: ReturnType<typeof useLocaleStore.getState>['locale'], max = 3) {
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
  }
}

export function deal(p: Product) {
  if (p.compareAtPrice == null || p.compareAtPrice <= p.price) return null
  return { percent: Math.round((1 - p.price / p.compareAtPrice) * 100), saved: p.compareAtPrice - p.price }
}

const isLow = (p: Product) => p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5)

/** "−14%" sticker in the brand colour. */
/**
 * Discount sticker: brand-blue gradient disc with "-11%" and a small "OFF" label, a crisp outline
 * (white in light mode, dark in dark mode) and a soft glow.
 * Uses a plain hyphen: the display font draws the true minus sign (−) like a tilde.
 */
function DealSticker({ percent, className }: { percent: number; className?: string }) {
  const t = useT()
  return (
    <span
      className={cn(
        'relative inline-flex flex-col items-center justify-center rounded-full bg-[radial-gradient(circle_at_32%_26%,#9be8ff_0%,var(--brand)_48%,#0091c2_100%)] text-[var(--brand-fg)] shadow-[0_8px_20px_-8px_rgb(0_145_194/0.6)] ring-[3px] ring-white dark:ring-[#0b1116]',
        className
      )}
      aria-label={`-${percent}% ${t('home.offLabel')}`}
    >
      <span className="font-display font-extrabold leading-none tracking-tight" aria-hidden="true">
        <span className="font-sans">-</span>
        {percent}
        <span className="text-[0.7em]">%</span>
      </span>
      <span className="mt-0.5 text-[0.42em] font-bold uppercase leading-none tracking-[0.14em] opacity-80" aria-hidden="true">
        {t('home.offLabel')}
      </span>
    </span>
  )
}

/** Dot + "Only 3 left" / "In stock". */
export function StockLine({ product, className }: { product: Product; className?: string }) {
  const t = useT()
  const low = isLow(product)
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', low ? 'text-[#ffc53d]' : 'text-[#3dd68c]', className)}>
      <span className="relative flex h-2 w-2">
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', low ? 'bg-[#ffc53d]' : 'bg-[#3dd68c]')} />
      </span>
      {low ? t('stock.onlyLeft', { count: product.stock }) : t('stock.inStock')}
    </span>
  )
}

/**
 * The frame around the spotlight (still border, soft dark-mode halo, deal sticker). Nothing moves but
 * the products inside, so it stays calm and matches both themes.
 * Rendered once; the products inside it change without rebuilding it.
 */
function SpotlightShell({ products, active, children }: { products: Product[]; active: number; children: ReactNode }) {
  return (
    <div className="relative">
      {/* Halo */}
      <div
        className="pointer-events-none absolute -inset-4 rounded-[3rem] sm:-inset-8 hidden dark:block dark:bg-[radial-gradient(closest-side,rgb(0_194_255/0.22),transparent)]"
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
              'absolute end-3 top-3 z-20 h-12 w-12 text-sm transition-[opacity,transform] sm:end-4 sm:top-4 sm:h-16 sm:w-16 sm:text-lg duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
              i === active ? '-rotate-6 scale-100 opacity-100' : 'pointer-events-none rotate-6 scale-75 opacity-0'
            )}
          />
        ) : null
      })}

      {/* Still border: neutral in light mode, a faint brand tint in dark mode */}
      <div className="group relative overflow-hidden rounded-[1.6rem] bg-[#dfe5ec] p-px shadow-[0_24px_50px_-28px_rgb(15_23_42/0.35)] dark:bg-[linear-gradient(160deg,rgb(0_194_255/0.45),rgb(255_255_255/0.08)_45%,rgb(0_194_255/0.25))] dark:shadow-[0_30px_80px_-24px_rgb(0_0_0/0.8)]">
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
          'relative isolate aspect-[16/10] flex-1 overflow-hidden sm:aspect-[4/3] sm:[@media(max-height:820px)]:aspect-[16/10]',
          contain ? 'photo-stage' : 'bg-[#0b1116]'
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
            contain ? 'object-contain px-5 pb-9 pt-5 mix-blend-multiply sm:px-6 sm:pb-12 sm:pt-10' : 'object-cover',
            photo.loaded ? 'opacity-100' : 'opacity-0'
          )}
        />

        {/* Whole picture opens the product; buttons below stay clickable */}
        <Link to={href} className="absolute inset-0 z-0" aria-label={product.name} />

        <span className="pointer-events-none absolute start-3 top-3 z-10 inline-flex h-7 items-center gap-1.5 rounded-full bg-[#0b1116]/80 px-2.5 text-[11px] font-semibold sm:start-4 sm:top-4 sm:h-8 sm:px-3 sm:text-xs">
          <SiteIcon name="star" size={13} solid className="text-[var(--brand)]" />
          {d ? t('home.spotlightDeal') : t('product.featuredPick')}
        </span>

        {/* Fade into the dark text area (a little past the edge, so no seam shows) */}
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 -bottom-px z-10 bg-gradient-to-t from-[#0b1116] to-transparent',
            contain ? 'h-20 via-[#0b1116]/40 sm:h-24' : 'h-16'
          )}
          aria-hidden="true"
        />
      </div>

      <div className="relative z-10 -mt-6 space-y-2.5 p-3.5 pt-0 sm:space-y-3 sm:p-5 sm:pt-0">
        <div className="min-w-0">
          {brand ? <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)] sm:text-xs">{brand}</p> : null}
          <p className="mt-0.5 line-clamp-2 font-display text-base font-semibold leading-snug drop-shadow sm:mt-1 sm:text-xl xl:text-2xl">
            {product.name}
            {product.variantLabel ? <span className="font-normal text-white/65"> · {product.variantLabel}</span> : null}
          </p>
          {specs.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5 max-sm:hidden">
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
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="whitespace-nowrap font-display text-[1.45rem] font-bold tracking-tight sm:text-[2rem] xl:text-[2.25rem]">{formatCurrency(product.price)}</span>
              {d ? <span className="whitespace-nowrap text-sm text-white/50 line-through sm:text-base">{formatCurrency(product.compareAtPrice!)}</span> : null}
            </p>
            {d ? (
              <p className="mt-1 inline-flex rounded-md bg-[var(--brand)]/20 px-2 py-0.5 text-[11px] font-semibold text-[#7adfff] sm:text-xs">
                {t('home.spotlightSave', { amount: formatCurrency(d.saved) })}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 space-y-1 text-end text-[11px] sm:space-y-1.5 sm:text-xs">
            <StockLine product={product} className="justify-end" />
            <p className="flex items-center justify-end gap-1 whitespace-nowrap text-white/65 max-sm:hidden">
              <SiteIcon name="banknote" size={12} />
              {t('deposit.payOnDelivery')}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={add}
            className="relative inline-flex h-10 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--brand)] px-4 text-sm font-semibold sm:h-12 sm:px-5 sm:text-base text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <SiteIcon name="cart" size={16} />
            {t('common.addToCart')}
          </button>
          <Link
            to={href}
            aria-label={t('product.viewProduct')}
            title={t('product.viewProduct')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 sm:h-12 sm:w-12 text-white transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
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

/** Same footprint as the card while the product loads, so the hero does not jump. */
export function HomeSpotlightSkeleton({ strip }: { strip?: boolean }) {
  return strip ? (
    <div className="relative aspect-[4/4.1] w-[70%] max-w-[16.5rem] overflow-hidden rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-muted)] dark:border-white/10 dark:bg-white/10">
      <ImageSpinner size="sm" tone="dark" />
    </div>
  ) : (
    <div className="relative aspect-square overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/10 [@media(max-height:820px)]:aspect-[5/4]">
      <ImageSpinner size="lg" tone="dark" />
    </div>
  )
}
