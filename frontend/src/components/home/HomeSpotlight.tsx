import { Link } from 'react-router-dom'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
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

/** Up to `max` headline specs (the template's important ones, in order), formatted for display. */
function keySpecs(p: Product, locale: ReturnType<typeof useLocaleStore.getState>['locale'], max = 3) {
  const category = typeof p.category === 'object' ? (p.category as Category) : null
  const tpl = getTemplate(resolveTemplate(p.specTemplate, category))
  const specs = p.specs || {}
  return tpl.important
    .filter((k) => String(specs[k] ?? '').trim())
    .slice(0, max)
    .map((k) => formatSpecValue(k, String(specs[k]), locale))
}

function useAddToCart(product: Product) {
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

function salePercent(p: Product) {
  return p.compareAtPrice != null && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : null
}

/** Desktop: the product beside the headline — photo, key specs, price, stock and actions. */
export function HomeSpotlightCard({ product }: { product: Product }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const src = sizedImageUrl(image, 960)
  const photo = useImageLoaded(src)
  const contain = imageFit(image) === 'contain'
  const off = salePercent(product)
  const brand = typeof product.brand === 'object' ? product.brand?.name : undefined
  const specs = keySpecs(product, locale)
  const low = product.stock > 0 && product.stock <= (product.lowStockThreshold ?? 5)
  const href = `/product/${product.slug}`

  return (
    <article className="group overflow-hidden rounded-[1.5rem] border border-white/15 bg-[var(--bg-elevated)]/95 shadow-soft-lg backdrop-blur-md dark:bg-[#0e1419]/85">
      <Link to={href} className="relative block focus-visible:outline-none" tabIndex={-1} aria-hidden="true">
        <div ref={photo.ref} className={cn('relative aspect-[4/3] overflow-hidden', contain ? 'bg-white' : 'bg-[var(--bg-muted)]')}>
          {photo.loaded ? null : <div className="absolute inset-0 animate-pulse bg-[var(--bg-muted)]" />}
          <SafeImage
            src={src}
            srcSet={imageSrcSet(image, [480, 640, 960, 1280])}
            sizes="26rem"
            alt=""
            width={960}
            height={720}
            referrerPolicy="no-referrer"
            onLoad={photo.onLoad}
            onError={photo.onError}
            className={cn(
              'absolute inset-0 h-full w-full max-w-none transition duration-500 group-hover:scale-[1.03]',
              contain ? 'object-contain p-5' : 'object-cover',
              photo.loaded ? 'opacity-100' : 'opacity-0'
            )}
          />
          <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 text-[11px] font-semibold text-[var(--brand-fg)] shadow-glow">
              <SiteIcon name="star" size={12} />
              {t('product.featuredPick')}
            </span>
            {off ? (
              <span className="inline-flex h-7 items-center rounded-full bg-black/60 px-2.5 text-[11px] font-bold text-white backdrop-blur-sm">−{off}%</span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div className="min-w-0">
          {brand ? <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-muted)]">{brand}</p> : null}
          <Link to={href} className="line-clamp-2 font-display text-base font-semibold leading-snug text-[var(--fg)] hover:text-[var(--brand-text)]">
            {product.name}
            {product.variantLabel ? <span className="font-normal text-[var(--fg-muted)]"> · {product.variantLabel}</span> : null}
          </Link>
          {specs.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {specs.map((s) => (
                <li key={s} className="max-w-full truncate rounded-md border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] text-[var(--fg-muted)]">
                  {s}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="leading-tight">
            <p className="font-display text-xl font-semibold text-[var(--brand-text)] dark:text-[var(--brand)]">{formatCurrency(product.price)}</p>
            {off ? <p className="text-xs text-[var(--fg-muted)] line-through">{formatCurrency(product.compareAtPrice!)}</p> : null}
          </div>
          <p className={cn('text-end text-[11px] font-medium', low ? 'text-[var(--warning)]' : 'text-[var(--success)]')}>
            {low ? t('stock.onlyLeft', { count: product.stock }) : t('stock.inStock')}
            <span className="block font-normal text-[var(--fg-muted)]">{t('deposit.payOnDelivery')}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={add}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
          >
            <SiteIcon name="cart" size={15} />
            {t('common.addToCart')}
          </button>
          <Link
            to={href}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[var(--border)] px-4 text-sm font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            {t('product.viewProduct')}
          </Link>
        </div>
      </div>
    </article>
  )
}

/** Phones and tablets: a slim strip under the hero buttons (keeps them above the fold). */
export function HomeSpotlightStrip({ product }: { product: Product }) {
  const t = useT()
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const contain = imageFit(image) === 'contain'
  const off = salePercent(product)

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/15 bg-black/40 p-2 pe-2.5 text-white backdrop-blur-md">
      <Link to={`/product/${product.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cn('relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl', contain ? 'bg-white' : 'bg-white/10')}>
          {image ? (
            <SafeImage
              src={sizedImageUrl(image, 160)}
              alt=""
              width={56}
              height={56}
              referrerPolicy="no-referrer"
              className={cn('h-full w-full', contain ? 'object-contain p-1' : 'object-cover')}
            />
          ) : (
            <SiteIcon name="package" size={18} />
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand)]">
            <SiteIcon name="star" size={10} />
            {t('product.featuredPick')}
          </span>
          <span className="block truncate text-sm font-medium">{product.name}</span>
          <span className="flex items-baseline gap-1.5 text-sm">
            <span className="font-semibold">{formatCurrency(product.price)}</span>
            {off ? <span className="text-[11px] text-white/60 line-through">{formatCurrency(product.compareAtPrice!)}</span> : null}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={add}
        aria-label={t('common.addToCart')}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <SiteIcon name="cart" size={16} />
      </button>
    </div>
  )
}

/** Same footprint as the card while the product loads, so the hero does not jump. */
export function HomeSpotlightSkeleton({ strip }: { strip?: boolean }) {
  return strip ? (
    <div className="h-[4.5rem] animate-pulse rounded-2xl border border-white/10 bg-white/10" aria-hidden="true" />
  ) : (
    <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/10" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-white/10" />
      <div className="h-44 animate-pulse" />
    </div>
  )
}
