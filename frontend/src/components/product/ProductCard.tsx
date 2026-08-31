import { Link } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import type { Product } from '@/types'
import { Price } from './Price'
import { RatingStars } from './RatingStars'
import { StockBadge } from './StockBadge'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useAuthStore } from '@/store/authStore'
import { useCompareStore } from '@/store/compareStore'
import { wishlistApi } from '@/api/wishlistApi'
import { toast } from '@/store/toastStore'
import { Button } from '@/components/ui/Button'
import { SafeImage } from '@/components/ui/SafeImage'
import { getErrorMessage } from '@/api/client'
import { cn } from '@/lib/cn'
import { optimizedImageUrl } from '@/lib/image'
import { useT } from '@/hooks/useT'

function primaryImage(product: Product) {
  return (
    product.images?.find((i) => i.isPrimary)?.url ||
    product.images?.[0]?.url ||
    'https://placehold.co/600x600/1a2229/00C2FF?text=Brynoxa'
  )
}

function salePercent(product: Product) {
  if (!product.compareAtPrice || product.compareAtPrice <= product.price) return null
  return Math.round((1 - product.price / product.compareAtPrice) * 100)
}

export function ProductCard({
  product,
  variant = 'grid',
}: {
  product: Product
  variant?: 'grid' | 'spotlight'
}) {
  const addItem = useCartStore((s) => s.addItem)
  const wishlisted = useWishlistStore((s) => s.isWishlisted(product._id))
  const toggleLocal = useWishlistStore((s) => s.toggleLocal)
  const setFromServer = useWishlistStore((s) => s.setFromServer)
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  const compareHas = useCompareStore((s) => s.has(product._id))
  const addCompare = useCompareStore((s) => s.add)
  const removeCompare = useCompareStore((s) => s.remove)
  const t = useT()
  const spotlight = variant === 'spotlight'
  const off = salePercent(product)

  const onAddCart = () => {
    if (product.stock <= 0) {
      toast.error(t('product.outOfStock'))
      return
    }
    addItem({
      productId: product._id,
      slug: product.slug,
      name: product.name,
      image: primaryImage(product),
      price: product.price,
      stock: product.stock,
      sku: product.sku,
    })
    toast.success(t('product.addedToCart'))
  }

  const onWishlist = async () => {
    try {
      if (isAuth) {
        if (wishlisted) {
          const res = await wishlistApi.remove(product._id)
          setFromServer(res.data.data)
          toast.info(t('product.removedWishlist'))
        } else {
          const res = await wishlistApi.add(product._id)
          setFromServer(res.data.data)
          toast.success(t('product.savedWishlist'))
        }
      } else {
        toggleLocal(product._id)
        toast.info(wishlisted ? t('product.removedWishlist') : t('product.savedLocal'))
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const onCompare = () => {
    if (compareHas) {
      removeCompare(product._id)
      toast.info(t('compare.remove'))
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
        'product-card group flex overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg',
        spotlight ? 'flex-col lg:grid lg:grid-cols-[1.35fr_1fr] lg:items-stretch' : 'flex-col'
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-[var(--bg-muted)]',
          spotlight ? 'aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-[22rem]' : 'aspect-square'
        )}
      >
        <Link to={`/product/${product.slug}`} className="block h-full w-full">
          <SafeImage
            src={optimizedImageUrl(primaryImage(product), spotlight ? 1200 : 640)}
            alt={product.name}
            referrerPolicy="no-referrer"
            decoding="async"
            loading={spotlight ? 'eager' : 'lazy'}
            width={600}
            height={600}
            sizes={
              spotlight
                ? '(min-width: 1024px) 52vw, 100vw'
                : '(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, 50vw'
            }
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
          />
        </Link>
        <div className="pointer-events-none absolute start-2 top-2 z-10 flex max-w-[calc(100%-3rem)] flex-wrap gap-1 sm:start-3 sm:top-3 sm:max-w-none sm:gap-2">
          {spotlight ? (
            <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--brand-fg)]">
              {t('product.featuredPick')}
            </span>
          ) : null}
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
        <button
          type="button"
          onClick={onWishlist}
          className={cn(
            'absolute end-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition sm:end-3 sm:top-3 sm:h-9 sm:w-9',
            wishlisted
              ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]'
              : 'border-[var(--border)] bg-[var(--bg-elevated)]/90 text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
          )}
          aria-label={wishlisted ? t('product.removeWishlist') : t('product.addWishlist')}
        >
          <SiteIcon name="heart" size={14} solid={wishlisted} />
        </button>
      </div>

      <div
        className={cn(
          'flex flex-1 flex-col',
          spotlight ? 'justify-center gap-2.5 p-4 sm:gap-3 sm:p-5 lg:p-6' : 'gap-1.5 p-3 sm:gap-2 sm:p-4'
        )}
      >
        <Link
          to={`/product/${product.slug}`}
          className={cn(
            'font-display font-semibold leading-snug text-[var(--fg)] transition duration-200 hover:text-[var(--brand-text)]',
            spotlight ? 'text-lg sm:text-xl lg:text-2xl' : 'line-clamp-2 text-[0.9375rem] leading-snug sm:text-base'
          )}
        >
          {product.name}
        </Link>
        {spotlight && product.shortDescription ? (
          <p className="line-clamp-2 max-w-md text-sm font-medium leading-relaxed text-[var(--fg-muted)]">
            {product.shortDescription}
          </p>
        ) : null}
        <div className={spotlight ? undefined : 'hidden sm:block'}>
          <RatingStars
            rating={product.averageRating}
            count={product.reviewCount}
            size={spotlight ? 'md' : 'sm'}
          />
        </div>
        <Price
          price={product.price}
          compareAt={product.compareAtPrice}
          showDiscountBadge={spotlight}
          className={
            spotlight
              ? '[&>span:first-child]:text-xl sm:[&>span:first-child]:text-2xl'
              : '[&>span:first-child]:text-base sm:[&>span:first-child]:text-lg'
          }
        />
        <div className={cn('flex items-center gap-2', spotlight ? 'mt-2' : 'mt-auto pt-2')}>
          <Button
            size="sm"
            className={cn(
              'rounded-full',
              spotlight
                ? 'h-9 px-4 text-sm sm:h-10 sm:px-5'
                : 'h-8 flex-1 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm'
            )}
            onClick={onAddCart}
            disabled={product.stock <= 0}
          >
            <SiteIcon name="cart" size={14} />
            {spotlight ? t('common.addToCart') : t('common.add')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={compareHas ? 'secondary' : 'outline'}
            className="h-8 w-9 shrink-0 !px-0 sm:h-9"
            onClick={onCompare}
            aria-label={compareHas ? t('compare.remove') : t('compare.add')}
            title={compareHas ? t('compare.remove') : t('compare.add')}
          >
            <SiteIcon name="layers" size={14} />
          </Button>
        </div>
      </div>
    </article>
  )
}
