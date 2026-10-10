import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'framer-motion'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { productsApi } from '@/api/productsApi'
import { wishlistApi } from '@/api/wishlistApi'
import { getErrorMessage } from '@/api/client'
import { Container } from '@/components/ui/Container'
import { Button } from '@/components/ui/Button'
import { PageLoader } from '@/components/ui/PageLoader'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ImageGallery } from '@/components/product/ImageGallery'
import { Price } from '@/components/product/Price'
import { QuantityStepper } from '@/components/product/QuantityStepper'
import { StockBadge } from '@/components/product/StockBadge'
import { CompleteSetup } from '@/components/product/CompleteSetup'
import { useCartStore } from '@/store/cartStore'
import { useWishlistStore } from '@/store/wishlistStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import { formatCurrency } from '@/lib/format'
import { trackViewItem } from '@/lib/analytics'
import { recordProductView } from '@/lib/push'
import { useSeo } from '@/hooks/useSeo'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { WhatsAppIcon } from '@/components/contact/BrandIcons'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { categoryDisplayName } from '@/i18n'
import type { Brand, Category, Product } from '@/types'
import { ConditionBadge } from '@/components/product/ConditionBadge'
import { isPreOwned } from '@/lib/condition'

function primaryImage(product: Product) {
  return product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url
}

export function ProductDetail() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const reduceMotion = useReducedMotion()
  const openWhatsAppPicker = useWhatsAppStore((s) => s.open)
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)

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

  // Track one view per product, not on every background refetch
  const trackedId = useRef<string | null>(null)
  useEffect(() => {
    const p = product.data
    if (!p || trackedId.current === p._id) return
    trackedId.current = p._id
    trackViewItem({
      item_id: p._id,
      item_name: p.name,
      item_sku: p.sku,
      price: p.price,
      quantity: 1,
    })
    recordProductView()
  }, [product.data])

  const productImage = product.data ? primaryImage(product.data) : undefined
  const productDescription =
    product.data?.shortDescription ||
    product.data?.description?.slice(0, 160) ||
    t('meta.shopDescription')

  useSeo({
    title: product.data ? `${product.data.name} — Brynoxa` : t('productPage.titleFallback'),
    description: productDescription,
    image: productImage || '/brand/brynoxa-logo-social.png',
    type: product.data ? 'product' : 'website',
    path: slug ? `/product/${slug}` : undefined,
    jsonLd: product.data
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: product.data.name,
          description: productDescription,
          image: productImage ? [productImage] : undefined,
          sku: product.data.sku,
          brand: product.data.brand
            ? {
                '@type': 'Brand',
                name:
                  typeof product.data.brand === 'string'
                    ? product.data.brand
                    : (product.data.brand as Brand).name,
              }
            : undefined,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'MAD',
            price: product.data.price,
            availability:
              product.data.stock > 0
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            url:
              typeof window !== 'undefined'
                ? `${window.location.origin}/product/${product.data.slug}`
                : undefined,
          },
        }
      : null,
  })

  const fade = (delay = 0) =>
    reduceMotion
      ? { initial: false as const, animate: { opacity: 1 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  if (product.isPending) {
    return (
      <Container className="pb-28 pt-4 sm:py-10 lg:pb-10">
        <div
          className="relative min-h-[24rem]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mb-6 flex gap-2" aria-hidden="true">
            <Skeleton className="h-4 w-16 ring-0" />
            <Skeleton className="h-4 w-24 ring-0" />
            <Skeleton className="h-4 w-32 ring-0" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-10" aria-hidden="true">
            <Skeleton className="aspect-square w-full rounded-[1.35rem] ring-0" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-28 ring-0" />
              <Skeleton className="h-9 w-[85%] ring-0" />
              <Skeleton className="h-6 w-40 ring-0" />
              <Skeleton className="h-20 w-full ring-0" />
              <Skeleton className="h-12 w-full rounded-full ring-0" />
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_50%,transparent)]">
            <PageLoader
              compact
              label={t('ui.loadingProducts')}
              className="min-h-0 rounded-2xl bg-[var(--bg-elevated)]/90 px-5 shadow-soft"
            />
          </div>
        </div>
      </Container>
    )
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

  const cartLine = {
    productId: p._id,
    slug: p.slug,
    name: p.name,
    image: primaryImage(p),
    price: p.price,
    stock: p.stock,
    sku: p.sku,
    condition: p.condition,
    qty,
  }

  const onAddCart = () => {
    addItem(cartLine)
    toast.success(t('product.addedToCart'))
  }

  // Buy now: put this product in the cart (once) and go straight to checkout
  const onBuyNow = () => {
    if (!useCartStore.getState().items.some((item) => item.productId === p._id)) addItem(cartLine)
    navigate('/checkout')
  }

  // All specifications, shown once as tiles beside the photos
  const specEntries = Object.entries((p.specs as Record<string, string>) || {})
  const outOfStock = p.stock <= 0

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
      itemCondition:
        p.condition === 'refurbished'
          ? 'https://schema.org/RefurbishedCondition'
          : p.condition === 'used'
            ? 'https://schema.org/UsedCondition'
            : 'https://schema.org/NewCondition',
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
      <Container className="pb-24 pt-3 sm:pb-10 sm:pt-6">
        <motion.nav
          {...fade(0)}
          className="mb-3 flex flex-wrap items-center gap-1.5 text-xs text-[var(--fg-muted)] sm:mb-4 sm:text-sm"
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

        <div className="grid items-start gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10">
          <motion.div {...fade(0.05)} className="md:sticky md:top-[calc(var(--nav-height)+1rem)]">
            <ImageGallery images={p.images || []} name={p.name} />
          </motion.div>

          <motion.div {...fade(0.1)} className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--fg-muted)] sm:text-sm">
              {brand ? <span className="font-medium text-[var(--fg)]">{brand.name}</span> : null}
              {brand && category ? <span aria-hidden="true">·</span> : null}
              {category ? (
                <Link to={`/category/${category.slug}`} className="hover:text-[var(--brand-text)]">
                  {categoryName}
                </Link>
              ) : null}
              {p.sku ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-[11px] tracking-wide sm:text-xs">{p.sku}</span>
                </>
              ) : null}
            </div>

            <h1 className="mt-1.5 font-display text-xl font-semibold leading-tight tracking-tight text-[var(--fg)] sm:text-2xl lg:text-3xl">
              {p.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 sm:gap-3">
              <ConditionBadge condition={p.condition} />
              <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />
            </div>

            <Price
              className="mt-3 [&>span:first-child]:text-2xl sm:[&>span:first-child]:text-[1.75rem]"
              price={p.price}
              compareAt={p.compareAtPrice}
            />

            {isPreOwned(p.condition) ? (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-3 py-2 text-[13px] leading-relaxed text-[var(--fg)] sm:text-sm">
                <SiteIcon name="refresh" size={16} className="mt-0.5 shrink-0 text-[var(--fg-muted)]" />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t('condition.noteTitle')}: {t(`condition.${p.condition}`)}
                  </p>
                  <p className="whitespace-pre-line break-words text-[var(--fg-muted)]">
                    {p.conditionNote?.trim() ||
                      t(p.condition === 'used' ? 'condition.usedNotice' : 'condition.refurbishedNotice')}
                  </p>
                </div>
              </div>
            ) : null}

            {p.deposit && p.deposit.value > 0 ? (
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--brand)]/40 bg-[var(--brand)]/[0.06] px-3 py-2 text-[13px] leading-relaxed text-[var(--fg)] sm:text-sm">
                <SiteIcon name="banknote" size={16} className="mt-0.5 shrink-0 text-[var(--brand-text)]" />
                {p.deposit.type === 'percent'
                  ? t('deposit.productPercent', { percent: p.deposit.value })
                  : t('deposit.productFixed', { amount: formatCurrency(p.deposit.value) })}
              </p>
            ) : null}

            {p.shortDescription ? (
              <p className="mt-3 text-sm leading-relaxed text-[var(--fg-muted)] sm:text-[0.95rem]">
                {p.shortDescription}
              </p>
            ) : null}

            {specEntries.length ? (
              <dl aria-label={t('productPage.specifications')} className="mt-4 grid grid-cols-2 gap-2">
                {specEntries.map(([key, value]) => (
                  <div
                    key={key}
                    className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2"
                  >
                    <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">
                      {key}
                    </dt>
                    <dd className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--fg)]">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}

            <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, p.stock)} />
                <Button
                  onClick={onAddCart}
                  disabled={outOfStock}
                  variant="outline"
                  className="hidden min-w-[9rem] flex-1 rounded-full sm:inline-flex"
                >
                  <SiteIcon name="cart" size={16} />
                  {t('common.addToCart')}
                </Button>
                <Button
                  onClick={onBuyNow}
                  disabled={outOfStock}
                  className="hidden min-w-[9rem] flex-1 rounded-full sm:inline-flex"
                >
                  {t('productPage.buyNow')}
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3 text-sm">
                <button
                  type="button"
                  onClick={onWishlist}
                  aria-pressed={wishlisted}
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--fg-muted)] transition hover:text-[var(--brand-text)] aria-pressed:text-[var(--brand-text)]"
                >
                  <SiteIcon name="heart" size={16} />
                  {wishlisted ? t('product.removeWishlist') : t('product.addWishlist')}
                </button>
                <button
                  type="button"
                  onClick={() => openWhatsAppPicker({ topic: 'product', productName: p.name })}
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--fg-muted)] transition hover:text-[var(--brand-text)]"
                >
                  <WhatsAppIcon size={16} />
                  {t('contact.whatsapp')}
                </button>
              </div>
            </div>

            <ul className="mt-3 flex flex-wrap gap-2">
              {proofChips.map(({ icon, label }) => (
                <li
                  key={label}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2.5 text-[11px] font-medium text-[var(--fg)] sm:text-xs"
                >
                  <SiteIcon name={icon} size={14} className="text-[var(--brand-text)]" />
                  {label}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <motion.div
          {...fade(0.12)}
          className="mt-6 sm:mt-8"
        >
          <section
            aria-labelledby="product-description-heading"
            className="relative overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft sm:p-7"
          >
            <span className="absolute inset-y-0 start-0 w-1 bg-[var(--brand)]" aria-hidden="true" />
            <h2
              id="product-description-heading"
              className="flex items-center gap-2.5 font-display text-xl font-semibold tracking-tight text-[var(--fg)] sm:text-2xl"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/15 text-[var(--brand-text)]">
                <SiteIcon name="package" size={18} />
              </span>
              {t('productPage.description')}
            </h2>
            <p className="mt-4 max-w-4xl whitespace-pre-wrap text-[15px] font-medium leading-7 text-[var(--fg)] sm:text-base sm:leading-8">
              {p.description}
            </p>
          </section>
        </motion.div>

        <CompleteSetup productId={p._id} />
      </Container>

      {/* Mobile sticky buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <Button
            onClick={onAddCart}
            disabled={outOfStock}
            variant="outline"
            className="h-11 min-w-0 flex-1 gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px]"
          >
            <SiteIcon name="cart" size={15} />
            {t('common.addToCart')}
          </Button>
          <Button
            onClick={onBuyNow}
            disabled={outOfStock}
            className="h-11 min-w-0 flex-1 whitespace-nowrap rounded-full px-3 text-[13px]"
          >
            {t('productPage.buyNow')}
          </Button>
        </div>
      </div>
    </>
  )
}
