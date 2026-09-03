import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { productsApi } from '@/api/productsApi'
import { reviewsApi } from '@/api/reviewsApi'
import { wishlistApi } from '@/api/wishlistApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PageLoader } from '@/components/ui/PageLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ImageGallery } from '@/components/product/ImageGallery'
import { Price } from '@/components/product/Price'
import { RatingStars } from '@/components/product/RatingStars'
import { QuantityStepper } from '@/components/product/QuantityStepper'
import { SpecTable } from '@/components/product/SpecTable'
import { StockBadge } from '@/components/product/StockBadge'
import { ProductGrid } from '@/components/product/ProductGrid'
import { surfaceCard } from '@/components/layout/pageStyles'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { formatDate } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayName } from '@/i18n'
import type { Brand, Category, Product, Review, User } from '@/types'

function primaryImage(product: Product) {
  return product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url
}

export function ProductDetail() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const reduceMotion = useReducedMotion()
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

  const related = useQuery({
    queryKey: [
      'products',
      'related',
      typeof product.data?.category === 'object' ? product.data.category.slug : '',
      product.data?._id,
    ],
    queryFn: async () => {
      const category =
        typeof product.data?.category === 'object' ? product.data.category.slug : undefined
      if (!category) return []
      const items = (await productsApi.list({ category, limit: 8, sort: 'popular' })).data.data
      return items.filter((item) => item._id !== product.data!._id).slice(0, 4)
    },
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

  const fade = (delay = 0) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  if (product.isLoading) {
    return <PageLoader label={t('ui.loadingPage')} />
  }

  if (product.isError) {
    return (
      <Container className="py-8 sm:py-10">
        <QueryErrorState
          title={t('shop.loadError')}
          description={t('shop.loadErrorBody')}
          onRetry={() => product.refetch()}
        />
      </Container>
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
  const categoryName = category
    ? categoryDisplayName(locale, category.slug, category.name)
    : null
  const wishlisted = isWish(p._id)

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
        if (wishlisted) {
          setFromServer((await wishlistApi.remove(p._id)).data.data)
          toast.info(t('product.removedWishlist'))
        } else {
          setFromServer((await wishlistApi.add(p._id)).data.data)
          toast.success(t('product.savedWishlist'))
        }
      } else {
        toggleLocal(p._id)
        toast.info(wishlisted ? t('product.removedWishlist') : t('product.savedLocal'))
      }
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
  }

  const proofChips = [
    { icon: 'package-check' as const, label: t('home.proofCod') },
    { icon: 'shield' as const, label: t('home.proofWarranty') },
  ]
  const productStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description,
    sku: p.sku,
    image: p.images.map((image) => image.url),
    brand: brand ? { '@type': 'Brand', name: brand.name } : undefined,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'MAD',
      price: p.price,
      availability:
        p.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: window.location.href,
    },
  }

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(productStructuredData)}</script>
      <Container className="pb-28 pt-4 sm:py-10 lg:pb-10">
        <motion.nav
          {...fade(0)}
          className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-[var(--fg-muted)] sm:mb-6 sm:gap-2 sm:text-sm"
        >
          <Link to="/shop" className="hover:text-[var(--brand-text)]">
            {t('common.shop')}
          </Link>
          {category ? (
            <>
              <span aria-hidden="true">/</span>
              <Link to={`/category/${category.slug}`} className="hover:text-[var(--brand-text)]">
                {categoryName}
              </Link>
            </>
          ) : null}
          <span aria-hidden="true">/</span>
          <span className="line-clamp-1 text-[var(--fg)]">{p.name}</span>
        </motion.nav>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
          <motion.div {...fade(0.05)}>
            <ImageGallery images={p.images || []} name={p.name} />
          </motion.div>

          <motion.div {...fade(0.1)}>
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--fg-muted)]">
              {brand ? <span className="font-medium text-[var(--fg)]">{brand.name}</span> : null}
              {brand && category ? <span>·</span> : null}
              {category ? (
                <Link to={`/category/${category.slug}`} className="hover:text-[var(--brand-text)]">
                  {categoryName}
                </Link>
              ) : null}
            </div>

            <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl">
              {p.name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 sm:gap-3">
              {p.reviewCount > 0 ? (
                <RatingStars rating={p.averageRating} count={p.reviewCount} size="md" />
              ) : null}
              <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />
            </div>

            <Price
              className="mt-4 [&>span:first-child]:text-2xl sm:[&>span:first-child]:text-[1.75rem]"
              price={p.price}
              compareAt={p.compareAtPrice}
            />

            <p className="mt-3 text-sm font-medium leading-relaxed text-[var(--fg)]/85 sm:mt-4 sm:text-base sm:leading-7">
              {p.shortDescription || p.description.slice(0, 180)}
            </p>

            <div className="mt-5 hidden flex-wrap items-center gap-3 sm:mt-6 sm:flex">
              <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, p.stock)} />
              <Button onClick={onAddCart} disabled={p.stock <= 0} className="rounded-full">
                <SiteIcon name="cart" size={16} />
                {t('common.addToCart')}
              </Button>
              <Button
                variant={wishlisted ? 'primary' : 'outline'}
                onClick={onWishlist}
                className="rounded-full"
                aria-label={wishlisted ? t('product.removeWishlist') : t('product.addWishlist')}
              >
                <SiteIcon name="heart" size={16} />
              </Button>
            </div>

            <ul className="mt-5 flex flex-wrap gap-2 sm:mt-6">
              {proofChips.map(({ icon, label }) => (
                <li
                  key={label}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-[11px] font-medium text-[var(--fg)] sm:h-9 sm:gap-2 sm:px-3 sm:text-xs"
                >
                  <SiteIcon name={icon} size={14} className="text-[var(--brand-text)]" />
                  {label}
                </li>
              ))}
            </ul>

            <div className="mt-8 sm:mt-10">
              <p className="kicker">{t('productPage.specs')}</p>
              <h2 className="mt-2 font-display text-lg font-semibold text-[var(--fg)] sm:text-xl">
                {t('productPage.description')}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-[var(--fg)]/80 sm:text-[0.975rem] sm:leading-7">
                {p.description}
              </p>
            </div>

            <div className="mt-6 sm:mt-8">
              <h2 className="mb-3 font-display text-lg font-semibold text-[var(--fg)] sm:text-xl">
                {t('productPage.specifications')}
              </h2>
              <SpecTable specs={(p.specs as Record<string, string>) || {}} />
            </div>
          </motion.div>
        </div>

        {related.data?.length ? (
          <motion.section {...fade(0.14)} className="mt-10 border-t border-[var(--border)] pt-8 sm:mt-12">
            <p className="kicker">{t('common.shop')}</p>
            <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-[var(--fg)] sm:text-3xl">
              {t('productPage.moreInCategory', { name: categoryName || t('shop.category') })}
            </h2>
            <div className="mt-6">
              <ProductGrid products={related.data} loading={related.isLoading} />
            </div>
          </motion.section>
        ) : null}

        <motion.section {...fade(0.16)} className="mt-8 border-t border-[var(--border)] pt-8 sm:mt-10">
          <p className="kicker">{t('productPage.reviews')}</p>
          <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-[var(--fg)] sm:text-3xl">
            {t('productPage.reviews')}
          </h2>
          <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[1fr_22rem] lg:gap-8">
            <div className="space-y-3 sm:space-y-4">
              {reviews.isLoading ? <PageLoader compact label={t('ui.loading')} className="min-h-0 py-8" /> : null}
              {reviews.isError ? (
                <QueryErrorState
                  title={t('shop.loadError')}
                  description={t('shop.loadErrorBody')}
                  onRetry={() => reviews.refetch()}
                />
              ) : null}
              {!reviews.isLoading && !reviews.isError && !reviews.data?.length ? (
                <p className="text-sm text-[var(--fg-muted)]">{t('productPage.noReviews')}</p>
              ) : null}
              {reviews.data?.map((r: Review) => {
                const user = typeof r.user === 'object' ? (r.user as User) : null
                return (
                  <article key={r._id} className={`${surfaceCard} p-4 sm:p-5`}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--fg)]">{user?.name || t('ui.customer')}</p>
                      <span className="text-xs text-[var(--fg-muted)]">{formatDate(r.createdAt)}</span>
                    </div>
                    <div className="mt-1">
                      <RatingStars rating={r.rating} />
                    </div>
                    <p className="mt-2 font-medium text-[var(--fg)]">{r.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-[var(--fg)]/75">{r.comment}</p>
                  </article>
                )
              })}
            </div>

            <div className={`${surfaceCard} p-5 sm:p-6`}>
              <h3 className="font-display text-lg font-semibold text-[var(--fg)]">{t('productPage.writeReview')}</h3>
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
                  <Input
                    label={t('ui.title')}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    minLength={3}
                  />
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
        </motion.section>
      </Container>

      {/* Mobile sticky buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, p.stock)} />
          <Button
            onClick={onAddCart}
            disabled={p.stock <= 0}
            className="h-11 flex-1 rounded-full text-sm"
          >
            <SiteIcon name="cart" size={16} />
            {t('common.addToCart')}
          </Button>
          <Button
            variant={wishlisted ? 'primary' : 'outline'}
            onClick={onWishlist}
            className="h-11 w-11 shrink-0 rounded-full !px-0"
            aria-label={wishlisted ? t('product.removeWishlist') : t('product.addWishlist')}
          >
            <SiteIcon name="heart" size={16} />
          </Button>
        </div>
      </div>
    </>
  )
}
