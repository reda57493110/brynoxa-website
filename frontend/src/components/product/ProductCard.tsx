import { Link } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import type { Product } from '@/types'
import { Price } from './Price'
import { RatingStars } from './RatingStars'
import { StockBadge } from './StockBadge'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useAuthStore } from '@/store/authStore'
import { wishlistApi } from '@/api/wishlistApi'
import { toast } from '@/store/toastStore'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/api/client'
import { cn } from '@/lib/cn'

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
  const spotlight = variant === 'spotlight'
  const off = salePercent(product)

  const onAddCart = () => {
    if (product.stock <= 0) {
      toast.error('Out of stock')
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
    toast.success('Added to cart')
  }

  const onWishlist = async () => {
    try {
      if (isAuth) {
        if (wishlisted) {
          const res = await wishlistApi.remove(product._id)
          setFromServer(res.data.data)
          toast.info('Removed from wishlist')
        } else {
          const res = await wishlistApi.add(product._id)
          setFromServer(res.data.data)
          toast.success('Saved to wishlist')
        }
      } else {
        toggleLocal(product._id)
        toast.info(wishlisted ? 'Removed from wishlist' : 'Saved locally — sign in to sync')
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <article
      className={cn(
        'group flex overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft transition duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg',
        spotlight ? 'flex-col lg:grid lg:grid-cols-2 lg:items-stretch' : 'flex-col'
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden bg-[var(--bg-muted)]',
          spotlight ? 'aspect-[16/10] lg:aspect-auto lg:min-h-[26rem]' : 'aspect-square'
        )}
      >
        <Link to={`/product/${product.slug}`} className="block h-full w-full">
          <img
            src={primaryImage(product)}
            alt={product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading={spotlight ? 'eager' : 'lazy'}
          />
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
          {spotlight ? (
            <span className="rounded-full bg-[var(--brand)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--brand-fg)]">
              Featured pick
            </span>
          ) : null}
          {off ? (
            <span className="rounded-full bg-[var(--fg)] px-2.5 py-1 text-[11px] font-bold text-[var(--bg)]">
              −{off}%
            </span>
          ) : null}
          <StockBadge stock={product.stock} threshold={product.lowStockThreshold} />
        </div>
        <button
          type="button"
          onClick={onWishlist}
          className={cn(
            'absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-md transition',
            wishlisted
              ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]'
              : 'border-[var(--border)] bg-[var(--bg-elevated)]/90 text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
          )}
          aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
        >
          <SiteIcon name="heart" size={16} solid={wishlisted} />
        </button>
      </div>

      <div
        className={cn(
          'flex flex-1 flex-col',
          spotlight ? 'justify-center gap-3 p-6 sm:p-8 lg:p-10' : 'gap-2 p-4'
        )}
      >
        <Link
          to={`/product/${product.slug}`}
          className={cn(
            'font-display font-semibold leading-snug transition hover:text-[var(--brand-text)]',
            spotlight ? 'text-2xl sm:text-3xl' : 'text-base'
          )}
        >
          {product.name}
        </Link>
        {spotlight && product.shortDescription ? (
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)] sm:text-base">
            {product.shortDescription}
          </p>
        ) : null}
        <RatingStars rating={product.averageRating} count={product.reviewCount} size={spotlight ? 'md' : 'sm'} />
        <Price
          price={product.price}
          compareAt={product.compareAtPrice}
          className={spotlight ? '[&>span:first-child]:text-2xl' : undefined}
        />
        <div className={cn('flex items-center gap-2', spotlight ? 'mt-4' : 'mt-auto pt-2')}>
          <Button
            size={spotlight ? 'lg' : 'sm'}
            className="flex-1 rounded-full"
            onClick={onAddCart}
            disabled={product.stock <= 0}
          >
            <SiteIcon name="cart" size={16} />
            {spotlight ? 'Add to cart' : 'Add'}
          </Button>
        </div>
      </div>
    </article>
  )
}
