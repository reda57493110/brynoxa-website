import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { productsApi } from '@/api/productsApi'
import { reviewsApi } from '@/api/reviewsApi'
import { wishlistApi } from '@/api/wishlistApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ImageGallery } from '@/components/product/ImageGallery'
import { Price } from '@/components/product/Price'
import { RatingStars } from '@/components/product/RatingStars'
import { QuantityStepper } from '@/components/product/QuantityStepper'
import { SpecTable } from '@/components/product/SpecTable'
import { StockBadge } from '@/components/product/StockBadge'
import { surfaceCard } from '@/components/layout/pageStyles'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import type { Brand, Category, Product, Review, User } from '@/types'

function primaryImage(product: Product) {
  return product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url
}

export function ProductDetail() {
  const t = useT()
  const { slug = '' } = useParams()
  const navigate = useNavigate()
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

  const product = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => (await productsApi.getBySlug(slug)).data.data,
    enabled: Boolean(slug),
  })

  usePageTitle(product.data ? `${product.data.name} — Brynoxa` : t('productPage.titleFallback'))

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
      toast.success(t('productPage.reviewSubmitted'))
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
      <Container className="py-8 sm:py-10">
        <EmptyState
          title={t('productPage.notFound')}
          description={t('productPage.notFoundBody')}
          actionLabel={t('shop.backToShop')}
          onAction={() => navigate('/shop')}
        />
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
    toast.success(t('product.addedToCart'))
  }

  const onWishlist = async () => {
    try {
      if (isAuth) {
        if (isWish(p._id)) {
          setFromServer((await wishlistApi.remove(p._id)).data.data)
          toast.info(t('product.removedWishlist'))
        } else {
          setFromServer((await wishlistApi.add(p._id)).data.data)
          toast.success(t('product.savedWishlist'))
        }
      } else {
        toggleLocal(p._id)
        toast.info(isWish(p._id) ? t('product.removedWishlist') : t('product.savedLocal'))
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const proofChips = [
    { icon: 'package-check' as const, label: t('home.proofCod') },
    { icon: 'shield' as const, label: t('home.proofWarranty') },
    { icon: 'truck' as const, label: t('home.proofShip') },
  ]

  return (
    <Container className="py-10">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-[var(--fg-muted)]">
        <Link to="/shop" className="hover:text-[var(--brand-text)]">
          {t('common.shop')}
        </Link>
        {category ? (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/category/${category.slug}`} className="hover:text-[var(--brand-text)]">
              {category.name}
            </Link>
          </>
        ) : null}
        <span aria-hidden="true">/</span>
        <span className="text-[var(--fg)]">{p.name}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-2">
        <ImageGallery images={p.images || []} name={p.name} />
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--fg-muted)]">
            {brand ? <span>{brand.name}</span> : null}
            {category ? (
              <>
                <span>·</span>
                <Link to={`/category/${category.slug}`} className="hover:text-[var(--brand-text)]">
                  {category.name}
                </Link>
              </>
            ) : null}
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{p.name}</h1>
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
            <Button onClick={onAddCart} disabled={p.stock <= 0} className="rounded-full">
              <SiteIcon name="cart" size={16} />
              {t('common.addToCart')}
            </Button>
            <Button
              variant={isWish(p._id) ? 'primary' : 'outline'}
              onClick={onWishlist}
              className="rounded-full"
              aria-label={isWish(p._id) ? t('product.removeWishlist') : t('product.addWishlist')}
            >
              <SiteIcon name="heart" size={16} />
            </Button>
          </div>

          <ul className="mt-6 flex flex-wrap gap-2">
            {proofChips.map(({ icon, label }) => (
              <li
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--fg)]"
              >
                <SiteIcon name={icon} size={14} className="text-[var(--brand)]" />
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <p className="kicker">
              {t('productPage.specs')}
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold">{t('productPage.description')}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg-muted)]">
              {p.description}
            </p>
          </div>
          <div className="mt-8">
            <h2 className="mb-3 font-display text-xl font-semibold">{t('productPage.specifications')}</h2>
            <SpecTable specs={(p.specs as Record<string, string>) || {}} />
          </div>
        </div>
      </div>

      <section className="mt-8 pt-8">
        <p className="kicker">
          {t('productPage.reviews')}
        </p>
        <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t('productPage.reviews')}</h2>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-4">
            {reviews.isLoading ? <Spinner /> : null}
            {!reviews.isLoading && !reviews.data?.length ? (
              <p className="text-sm text-[var(--fg-muted)]">{t('productPage.noReviews')}</p>
            ) : null}
            {reviews.data?.map((r: Review) => {
              const user = typeof r.user === 'object' ? (r.user as User) : null
              return (
                <article key={r._id} className={`${surfaceCard} p-5`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{user?.name || t('ui.customer')}</p>
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

          <div className={`${surfaceCard} p-6`}>
            <h3 className="font-display text-lg font-semibold">{t('productPage.writeReview')}</h3>
            {!isAuth ? (
              <p className="mt-3 text-sm text-[var(--fg-muted)]">
                <Link to="/login" className="font-medium text-[var(--brand-text)]">
                  {t('common.signIn')}
                </Link>{' '}
                {t('productPage.signInToReview')}
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
                  <span className="font-medium">{t('productPage.rating')}</span>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 outline-none ring-brand"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {t('productPage.stars', { n })}
                      </option>
                    ))}
                  </select>
                </label>
                <Input label={t('ui.title')} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />
                <Textarea
                  label={t('ui.comment')}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  required
                  minLength={10}
                />
                <Button type="submit" loading={reviewMutation.isPending} className="w-full rounded-full">
                  {t('productPage.submitReview')}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </Container>
  )
}
