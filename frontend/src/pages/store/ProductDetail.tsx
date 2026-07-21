import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GitCompareArrows, Heart, ShoppingBag } from 'lucide-react'
import { productsApi } from '@/api/productsApi'
import { reviewsApi } from '@/api/reviewsApi'
import { wishlistApi } from '@/api/wishlistApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Spinner } from '@/components/ui/Spinner'
import { ImageGallery } from '@/components/product/ImageGallery'
import { Price } from '@/components/product/Price'
import { RatingStars } from '@/components/product/RatingStars'
import { QuantityStepper } from '@/components/product/QuantityStepper'
import { SpecTable } from '@/components/product/SpecTable'
import { StockBadge } from '@/components/product/StockBadge'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useCompareStore } from '@/store/compareStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/lib/format'
import type { Brand, Category, Product, Review, User } from '@/types'

function primaryImage(product: Product) {
  return product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url
}

export function ProductDetail() {
  const { slug = '' } = useParams()
  const qc = useQueryClient()
  const [qty, setQty] = useState(1)
  const [rating, setRating] = useState(5)
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')

  const addItem = useCartStore((s) => s.addItem)
  const isAuth = useAuthStore((s) => s.isAuthenticated())
  const isWish = useWishlistStore((s) => s.isWishlisted)
  const toggleLocal = useWishlistStore((s) => s.toggleLocal)
  const setFromServer = useWishlistStore((s) => s.setFromServer)
  const compareHas = useCompareStore((s) => s.has)
  const compareAdd = useCompareStore((s) => s.add)
  const compareRemove = useCompareStore((s) => s.remove)

  const product = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => (await productsApi.getBySlug(slug)).data.data,
    enabled: Boolean(slug),
  })

  const reviews = useQuery({
    queryKey: ['reviews', product.data?._id],
    queryFn: async () =>
      (await reviewsApi.forProduct(product.data!._id, { limit: 20 })).data.data,
    enabled: Boolean(product.data?._id),
  })

  const reviewMutation = useMutation({
    mutationFn: () =>
      reviewsApi.create({
        productId: product.data!._id,
        rating,
        title,
        comment,
      }),
    onSuccess: () => {
      toast.success('Review submitted')
      setTitle('')
      setComment('')
      qc.invalidateQueries({ queryKey: ['reviews', product.data?._id] })
      qc.invalidateQueries({ queryKey: ['product', slug] })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (product.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!product.data) {
    return (
      <Container className="py-16 text-center">
        <h1 className="font-display text-2xl">Product not found</h1>
        <Link to="/shop" className="mt-4 inline-block text-[var(--brand)]">
          Back to shop
        </Link>
      </Container>
    )
  }

  const p = product.data
  const category = typeof p.category === 'object' ? (p.category as Category) : null
  const brand = typeof p.brand === 'object' ? (p.brand as Brand) : null

  const onAddCart = () => {
    addItem({
      productId: p._id,
      slug: p.slug,
      name: p.name,
      image: primaryImage(p),
      price: p.price,
      stock: p.stock,
      sku: p.sku,
      qty,
    })
    toast.success('Added to cart')
  }

  const onWishlist = async () => {
    try {
      if (isAuth) {
        if (isWish(p._id)) {
          setFromServer((await wishlistApi.remove(p._id)).data.data)
          toast.info('Removed from wishlist')
        } else {
          setFromServer((await wishlistApi.add(p._id)).data.data)
          toast.success('Saved to wishlist')
        }
      } else {
        toggleLocal(p._id)
        toast.info(isWish(p._id) ? 'Removed from wishlist' : 'Saved locally — sign in to sync')
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  return (
    <Container className="py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <ImageGallery images={p.images || []} name={p.name} />
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--fg-muted)]">
            {brand ? <span>{brand.name}</span> : null}
            {category ? (
              <>
                <span>·</span>
                <Link to={`/category/${category.slug}`} className="hover:text-[var(--brand)]">
                  {category.name}
                </Link>
              </>
            ) : null}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{p.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RatingStars rating={p.averageRating} count={p.reviewCount} size="md" />
            <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />
          </div>
          <Price className="mt-4" price={p.price} compareAt={p.compareAtPrice} />
          <p className="mt-4 text-[var(--fg-muted)]">
            {p.shortDescription || p.description.slice(0, 180)}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, p.stock)} />
            <Button onClick={onAddCart} disabled={p.stock <= 0}>
              <ShoppingBag className="h-4 w-4" />
              Add to cart
            </Button>
            <Button variant={isWish(p._id) ? 'primary' : 'outline'} onClick={onWishlist}>
              <Heart className={`h-4 w-4 ${isWish(p._id) ? 'fill-current' : ''}`} />
            </Button>
            <Button
              variant={compareHas(p._id) ? 'primary' : 'outline'}
              onClick={() => {
                if (compareHas(p._id)) {
                  compareRemove(p._id)
                  toast.info('Removed from compare')
                } else {
                  const ok = compareAdd(p)
                  toast[ok ? 'success' : 'error'](ok ? 'Added to compare' : 'Compare list full (max 4)')
                }
              }}
            >
              <GitCompareArrows className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-10">
            <h2 className="font-display text-xl font-semibold">Description</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg-muted)]">
              {p.description}
            </p>
          </div>
          <div className="mt-8">
            <h2 className="mb-3 font-display text-xl font-semibold">Specifications</h2>
            <SpecTable specs={(p.specs as Record<string, string>) || {}} />
          </div>
        </div>
      </div>

      <section className="mt-16 border-t border-[var(--border)] pt-10">
        <h2 className="font-display text-2xl font-semibold">Reviews</h2>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {reviews.isLoading ? <Spinner /> : null}
            {!reviews.isLoading && !reviews.data?.length ? (
              <p className="text-sm text-[var(--fg-muted)]">No reviews yet.</p>
            ) : null}
            {reviews.data?.map((r: Review) => {
              const user = typeof r.user === 'object' ? (r.user as User) : null
              return (
                <article
                  key={r._id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{user?.name || 'Customer'}</p>
                    <span className="text-xs text-[var(--fg-muted)]">{formatDate(r.createdAt)}</span>
                  </div>
                  <div className="mt-1">
                    <RatingStars rating={r.rating} />
                  </div>
                  <p className="mt-2 font-medium">{r.title}</p>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">{r.comment}</p>
                </article>
              )
            })}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft">
            <h3 className="font-display text-lg font-semibold">Write a review</h3>
            {!isAuth ? (
              <p className="mt-3 text-sm text-[var(--fg-muted)]">
                <Link to="/login" className="text-[var(--brand)]">
                  Sign in
                </Link>{' '}
                to leave a review.
              </p>
            ) : (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  reviewMutation.mutate()
                }}
              >
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="font-medium">Rating</span>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} stars
                      </option>
                    ))}
                  </select>
                </label>
                <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
                <Textarea
                  label="Comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  minLength={10}
                />
                <Button type="submit" loading={reviewMutation.isPending} className="w-full">
                  Submit review
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </Container>
  )
}
