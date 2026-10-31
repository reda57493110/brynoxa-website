import { ImageSpinner } from '@/components/ui/ImageLoader'
import { Link } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import type { Product } from '@/types'
import { Price } from './Price'
import { StockBadge } from './StockBadge'
import { ConditionBadge } from './ConditionBadge'
import { useCartStore } from '@/store/cartStore'
import { useCompareStore } from '@/store/compareStore'
import { toast } from '@/store/toastStore'
import { Button } from '@/components/ui/Button'
import { SafeImage } from '@/components/ui/SafeImage'
import { useImageLoaded } from '@/hooks/useImageLoaded'
import { cn } from '@/lib/cn'
import { imageFit, imageSrcSet, sizedImageUrl } from '@/lib/image'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayName } from '@/i18n'
import { keySpecs } from '@/components/home/HomeSpotlight'
import { formatCurrency } from '@/lib/format'
import type { Locale } from '@/i18n'

/** Main photo, or undefined (the card then shows a neutral placeholder — no external request). */
function primaryImage(product: Product) {
  return product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url || undefined
}

function salePercent(product: Product) {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return null
  return Math.round((1 - product.price / product.compareAtPrice) * 100)
}

function brandName(product: Product) {
  return typeof product.brand === 'object' && product.brand ? product.brand.name : null
}

function categoryName(product: Product, locale: Locale) {
  if (typeof product.category !== 'object' || !product.category) return null
  return categoryDisplayName(locale, product.category.slug, product.category.name)
}

export function ProductCard({
  product,
  variant = 'grid',
  eager = false,
}: {
  product: Product
  variant?: 'grid' | 'spotlight'
  /** First cards of a list: the photo downloads at once instead of waiting to be scrolled near */
  eager?: boolean
}) {
  const addItem = useCartStore((s) => s.addItem)
  const compareHas = useCompareStore((s) => s.has(product._id))
  const addCompare = useCompareStore((s) => s.add)
  const removeCompare = useCompareStore((s) => s.remove)
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  // Featured card: the product's headline specs (processor, memory, storage…)
  const specs = variant === 'spotlight' ? keySpecs(product, locale, 4) : []
  const spotlight = variant === 'spotlight'
  const off = salePercent(product)
  const brand = brandName(product)
  const category = categoryName(product, locale)
  // Grid cards stay short: brand only; the spotlight card has room for the category too
  const meta = spotlight ? [brand, category].filter(Boolean).join(' · ') : brand || category
  const blurb = product.shortDescription?.trim()
  const original = primaryImage(product)
  // Sized for the card: phones get ~320 px, desktop grids ~480 px, the spotlight up to 1600 px
  const imageSrc = sizedImageUrl(original, spotlight ? 1200 : 480)
  const imageSrcSetValue = imageSrcSet(original, spotlight ? [640, 960, 1280, 1600] : [320, 480, 640, 800])
  const contain = imageFit(original) === 'contain'
  const photo = useImageLoaded(imageSrc)

  const onAddCart = () => {
    if (product.stock <= 0) {
      toast.error(t('product.outOfStock'))
      return
    }
    addItem({
      productId: product._id,
      slug: product.slug,
      // Variants share a name; the options tell them apart in the cart
      name: product.variantLabel ? `${product.name} (${product.variantLabel})` : product.name,
      image: original,
      price: product.price,
      stock: product.stock,
      sku: product.sku,
      condition: product.condition,
    })
  }

  const onCompare = () => {
    if (compareHas) {
      removeCompare(product._id)
      toast.info(t('compare.removed'))
      return
    }
    if (addCompare(product)) {
      toast.success(t('compare.added'))
    } else {
      toast.info(t('compare.full', { max: 4 }))
    }
  }

  return (
    <article
      className={cn(
        'product-card group flex h-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg',
        spotlight ? 'flex-col lg:grid lg:grid-cols-[1.15fr_1fr] lg:items-stretch' : 'flex-col'
      )}
    >
      <div
        ref={photo.ref}
        className={cn(
          // Fills the card to its edges, rounded on all four corners like the card itself
          'relative overflow-hidden rounded-[calc(var(--radius-card)-1px)]',
          contain ? 'photo-stage' : 'bg-[var(--bg-muted)]',
          spotlight
            ? 'aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[20rem] lg:max-h-[26rem]'
            : 'aspect-square'
        )}
      >
        {/* Loading indicator while the photo downloads */}
        {photo.loaded ? null : <ImageSpinner size={spotlight ? 'lg' : 'md'} />}
        <Link to={`/product/${product.slug}`} className="relative block h-full w-full">
          <SafeImage
            src={imageSrc}
            srcSet={imageSrcSetValue}
            onLoad={photo.onLoad}
            onError={photo.onError}
            alt={product.name}
            referrerPolicy="no-referrer"
            decoding="async"
            loading={spotlight || eager ? 'eager' : 'lazy'}
            width={600}
            height={600}
            sizes={
              spotlight
                ? '(min-width: 1024px) 52vw, 100vw'
                : '(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 46vw'
            }
            className={cn(
              'h-full w-full transition duration-500 ease-out group-hover:scale-[1.03]',
              contain ? 'object-contain p-3 mix-blend-multiply sm:p-5' : 'object-cover',
              photo.loaded ? 'opacity-100' : 'opacity-0'
            )}
          />
        </Link>
        <div className="pointer-events-none absolute start-2 top-2 z-10 flex max-w-[calc(100%-3rem)] flex-wrap gap-1 sm:start-3 sm:top-3 sm:max-w-none sm:gap-2">
          {spotlight ? (
            <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--brand-fg)]">
              {t('product.featuredPick')}
            </span>
          ) : null}
          <ConditionBadge condition={product.condition} size="sm" />
          {off ? (
            <span className="rounded-full bg-[var(--fg)] px-2 py-0.5 text-[10px] font-bold text-[var(--bg)] sm:px-2.5 sm:py-1 sm:text-[11px]">
              −{off}%
            </span>
          ) : null}
          <StockBadge
            stock={product.stock}
            threshold={product.lowStockThreshold}
            compact={!spotlight}
          />
        </div>
        {!spotlight ? (
          <button
            type="button"
            onClick={onCompare}
            className={cn(
              'absolute end-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition sm:end-3 sm:top-3 sm:h-9 sm:w-9',
              compareHas
                ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]'
                : 'border-[var(--border)] bg-[var(--bg-elevated)]/90 text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
            )}
            aria-label={compareHas ? t('compare.remove') : t('compare.add')}
            title={compareHas ? t('compare.remove') : t('compare.add')}
          >
            <SiteIcon name="layers" size={14} />
          </button>
        ) : null}
      </div>

      <div
        className={cn(
          'flex flex-1 flex-col',
          spotlight
            ? 'relative justify-center gap-2.5 bg-[radial-gradient(120%_90%_at_100%_0%,color-mix(in_srgb,var(--brand)_10%,transparent),transparent_60%)] p-4 sm:gap-3 sm:p-6 lg:px-10 lg:py-8'
            : 'gap-1 p-2.5 sm:gap-2 sm:p-4'
        )}
      >
        <p
          className={cn(
            'font-medium uppercase tracking-[0.12em] text-[var(--fg-muted)]',
            spotlight ? 'text-[11px]' : 'min-h-[1rem] text-[9px] sm:min-h-[1.2rem] sm:text-[11px]'
          )}
        >
          {meta || '\u00A0'}
        </p>
        <Link
          to={`/product/${product.slug}`}
          className={cn(
            'font-display font-semibold leading-snug text-[var(--fg)] transition duration-200 hover:text-[var(--brand-text)]',
            spotlight
              ? 'text-lg sm:text-2xl lg:text-[1.75rem] lg:leading-tight'
              : 'line-clamp-2 min-h-[2rem] text-xs leading-snug sm:min-h-[2.75rem] sm:text-base'
          )}
        >
          {product.name}
        </Link>
        {spotlight && blurb ? (
          <p className="line-clamp-2 max-w-md text-sm font-medium leading-relaxed text-[var(--fg-muted)]">{blurb}</p>
        ) : null}
        {spotlight && specs.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {specs.map((s) => (
              <li
                key={s.key}
                className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-xs font-medium text-[var(--fg)]"
              >
                <SiteIcon name={s.icon} size={13} className="shrink-0 text-[var(--brand-text)]" />
                <span className="truncate">{s.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className={cn('mt-auto flex flex-col', spotlight ? 'mt-2 gap-2' : 'gap-2 pt-2')}>
          <Price
            price={product.price}
            compareAt={product.compareAtPrice}
            showDiscountBadge={false}
            className={
              spotlight
                ? '[&>span:first-child]:text-2xl sm:[&>span:first-child]:text-[2rem]'
                : 'min-h-[1.5rem] items-center sm:min-h-[1.875rem] [&>span:first-child]:text-sm sm:[&>span:first-child]:text-lg'
            }
          />
          {/* Always the same height, so prices and buttons line up across a row */}
          {!spotlight ? (
            <p className="-mt-1 min-h-[0.875rem] truncate text-[10px] font-medium text-[var(--brand-text)] sm:min-h-4 sm:text-xs">
              {product.variantGroup ? t('productPage.moreOptions') : ' '}
            </p>
          ) : (
            <div className="-mt-1 flex flex-wrap items-center gap-2">
              {off ? (
                <span className="inline-flex rounded-md bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] px-2 py-0.5 text-xs font-semibold text-[var(--brand-text)]">
                  {t('home.spotlightSave', { amount: formatCurrency(product.compareAtPrice! - product.price) })}
                </span>
              ) : null}
              {product.variantGroup ? <span className="text-xs font-medium text-[var(--brand-text)]">{t('productPage.moreOptions')}</span> : null}
            </div>
          )}
          <div className={cn('flex items-center', spotlight ? 'gap-2' : 'gap-1 sm:gap-2')}>
            {!spotlight ? (
              <Link
                to={`/product/${product.slug}`}
                className="inline-flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-[var(--border)] px-1 text-xs font-semibold text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] sm:h-9 sm:px-3 sm:text-sm"
              >
                <span className="truncate">{t('product.details')}</span>
                <SiteIcon name="arrow-right" size={13} className="hidden shrink-0 rtl:rotate-180 sm:block" />
              </Link>
            ) : null}
            <Button
              size="sm"
              className={cn(
                'rounded-full',
                spotlight
                  ? 'h-11 flex-1 px-5 text-sm sm:max-w-xs sm:text-base'
                  : 'h-8 min-w-0 flex-1 gap-1 px-1 text-xs sm:h-9 sm:gap-2 sm:px-3 sm:text-sm'
              )}
              onClick={onAddCart}
              disabled={product.stock <= 0}
              aria-label={spotlight ? undefined : t('common.addToCart')}
            >
              <SiteIcon name="cart" size={14} />
              {spotlight ? t('common.addToCart') : t('common.add')}
            </Button>
            {spotlight ? (
            <Button
              type="button"
              size="sm"
              variant={compareHas ? 'secondary' : 'outline'}
              className="h-11 w-11 shrink-0 !px-0"
              onClick={onCompare}
              aria-label={compareHas ? t('compare.remove') : t('compare.add')}
              title={compareHas ? t('compare.remove') : t('compare.add')}
            >
              <SiteIcon name="layers" size={14} />
            </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
