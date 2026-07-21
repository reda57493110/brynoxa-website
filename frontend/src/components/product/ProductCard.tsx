import { Link } from 'react-router-dom'
import { GitCompareArrows, Heart, ShoppingBag } from 'lucide-react'
import type { Product } from '@/types'
import { Price } from './Price'
import { RatingStars } from './RatingStars'
import { StockBadge } from './StockBadge'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useCompareStore } from '@/store/compareStore'
import { useAuthStore } from '@/store/authStore'
import { wishlistApi } from '@/api/wishlistApi'
import { toast } from '@/store/toastStore'
import { Button } from '@/components/ui/Button'
import { getErrorMessage } from '@/api/client'

function primaryImage(product: Product) {
  return (
    product.images?.find((i) => i.isPrimary)?.url ||
    product.images?.[0]?.url ||
    'https://placehold.co/600x600/1a2229/00C2FF?text=Brynoxa'
  )
}

export function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem)
  const wishlisted = useWishlistStore((s) => s.isWishlisted(product._id))
  const toggleLocal = useWishlistStore((s) => s.toggleLocal)
  const setFromServer = useWishlistStore((s) => s.setFromServer)
  const compareHas = useCompareStore((s) => s.has(product._id))
  const compareAdd = useCompareStore((s) => s.add)
  const compareRemove = useCompareStore((s) => s.remove)
  const isAuth = useAuthStore((s) => s.isAuthenticated())

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

  const onCompare = () => {
    if (compareHas) {
      compareRemove(product._id)
      toast.info('Removed from compare')
      return
    }
    const ok = compareAdd(product)
    if (!ok) toast.error('Compare list is full (max 4)')
    else toast.success('Added to compare')
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] shadow-soft transition hover:-translate-y-0.5 hover:shadow-soft-lg">
      <Link to={`/product/${product.slug}`} className="relative aspect-square overflow-hidden bg-[var(--bg-muted)]">
        <img
          src={primaryImage(product)}
          alt={product.name}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute left-3 top-3">
          <StockBadge stock={product.stock} threshold={product.lowStockThreshold} />
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link to={`/product/${product.slug}`} className="font-display text-base font-semibold leading-snug hover:text-[var(--brand)]">
          {product.name}
        </Link>
        <RatingStars rating={product.averageRating} count={product.reviewCount} />
        <Price price={product.price} compareAt={product.compareAtPrice} />
        <div className="mt-auto flex items-center gap-2 pt-2">
          <Button size="sm" className="flex-1" onClick={onAddCart} disabled={product.stock <= 0}>
            <ShoppingBag className="h-4 w-4" />
            Add
          </Button>
          <Button
            size="sm"
            variant={wishlisted ? 'primary' : 'outline'}
            onClick={onWishlist}
            aria-label="Wishlist"
          >
            <Heart className={`h-4 w-4 ${wishlisted ? 'fill-current' : ''}`} />
          </Button>
          <Button
            size="sm"
            variant={compareHas ? 'primary' : 'outline'}
            onClick={onCompare}
            aria-label="Compare"
          >
            <GitCompareArrows className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </article>
  )
}
