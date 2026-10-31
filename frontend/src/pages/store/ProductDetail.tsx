import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { productsApi } from '@/api/productsApi'
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
import { SimilarProducts } from '@/components/product/SimilarProducts'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/format'
import { trackViewItem } from '@/lib/analytics'
import { recordProductView } from '@/lib/push'
import { useSeo } from '@/hooks/useSeo'
import { productData } from '@/lib/structuredData'
import { productSeoText } from '@/lib/productSeo'
import { keySpecs } from '@/components/home/HomeSpotlight'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { WhatsAppIcon } from '@/components/contact/BrandIcons'
import { useWhatsAppStore } from '@/store/whatsappStore'
import { HelpLink } from '@/components/help/HelpLink'
import { categoryDisplayName } from '@/i18n'
import type { Brand, Category, Product } from '@/types'
import { ConditionBadge } from '@/components/product/ConditionBadge'
import { isPreOwned } from '@/lib/condition'
import { resolveTemplate } from '@/lib/specs'
import { ProductSpecs } from '@/components/product/ProductSpecs'
import { VariantPicker } from '@/components/product/VariantPicker'

function primaryImage(product: Product) {
  return product.images?.find((i) => i.isPrimary)?.url || product.images?.[0]?.url
}

/**
 * A fresh page for each product: the quantity, chosen photo and other choices never carry over
 * when moving to another product (similar products, versions, search).
 */
export function ProductDetail() {
  const { slug = '' } = useParams()
  return <ProductDetailPage key={slug} />
}

function ProductDetailPage() {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const openWhatsAppPicker = useWhatsAppStore((s) => s.open)
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const [qty, setQty] = useState(1)

  const addItem = useCartStore((s) => s.addItem)

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

  // Google title / snippet: model + key specs + price in Morocco + our promises (page language)
  const seoText = product.data
    ? productSeoText({
        name: product.data.variantLabel ? `${product.data.name} (${product.data.variantLabel})` : product.data.name,
        price: product.data.price,
        specs: keySpecs(product.data, locale, 4).map((s) => s.value),
        shortDescription: product.data.shortDescription,
        locale,
      })
    : null

  useSeo({
    title: seoText?.title ?? t('productPage.titleFallback'),
    description: seoText?.description ?? productDescription,
    // A product that is gone (or still loading) is not a page for Google
    noIndex: !product.data,
    image: productImage || '/brand/brynoxa-logo-social.png',
    type: product.data ? 'product' : 'website',
    path: slug ? `/product/${slug}` : undefined,
    jsonLd: product.data ? productData(product.data, productDescription) : null,
  })

  // Rise in with CSS: visible at once, never waiting for the animation code (loaded after paint)
  const fade = (delay = 0) => ({ 'data-rise': 'card', style: { animationDelay: `${Math.round(delay * 1000)}ms` } })

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

  const cartLine = {
    productId: p._id,
    slug: p.slug,
    // Variants share a name; the options tell them apart in the cart
    name: p.variantLabel ? `${p.name} (${p.variantLabel})` : p.name,
    image: primaryImage(p),
    price: p.price,
    stock: p.stock,
    sku: p.sku,
    condition: p.condition,
    qty,
  }

  const onAddCart = () => {
    addItem(cartLine)
  }

  // Buy now: put this product in the cart (once) and go straight to checkout
  const onBuyNow = () => {
    if (!useCartStore.getState().items.some((item) => item.productId === p._id)) addItem(cartLine)
    navigate('/checkout')
  }

  // Specifications are shown once, beside the photos, grouped by the product's spec type
  const specTemplate = resolveTemplate(p.specTemplate, category)
  const outOfStock = p.stock <= 0

  const proofChips = [
    { icon: 'package-check' as const, label: t('home.proofCod') },
    { icon: 'shield' as const, label: t('home.proofWarranty') },
  ]

  return (
    <>
      <Container className="pb-24 pt-3 sm:pb-10 sm:pt-6">
        <nav
          {...fade(0)}
          className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--fg-muted)] sm:mb-4 sm:text-sm"
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
        </nav>

        <div className="grid items-start gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-10">
          <div {...fade(0.05)} className="md:sticky md:top-[calc(var(--nav-height)+1rem)]">
            <ImageGallery images={p.images || []} name={p.name} />
          </div>

          <div {...fade(0.1)} className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--fg-muted)] sm:text-sm">
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
                  <span className="font-mono text-[10px] tracking-wide sm:text-xs">{p.sku}</span>
                </>
              ) : null}
            </div>

            <h1 className="mt-1 font-display text-base font-semibold leading-snug tracking-tight text-[var(--fg)] sm:mt-1.5 sm:text-2xl lg:text-3xl">
              {p.name}
            </h1>

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:mt-2 sm:gap-3">
              <ConditionBadge condition={p.condition} />
              <StockBadge stock={p.stock} threshold={p.lowStockThreshold} />
            </div>

            <Price
              className="mt-2 [&>span:first-child]:text-xl sm:mt-3 sm:[&>span:first-child]:text-[1.75rem]"
              price={p.price}
              compareAt={p.compareAtPrice}
            />

            {isPreOwned(p.condition) ? (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 px-2.5 py-1.5 text-xs leading-relaxed text-[var(--fg)] sm:px-3 sm:py-2 sm:text-sm">
                <SiteIcon name="refresh" size={14} className="mt-0.5 shrink-0 text-[var(--fg-muted)]" />
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
              <p className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--brand)]/40 bg-[var(--brand)]/[0.06] px-2.5 py-1.5 text-xs leading-relaxed text-[var(--fg)] sm:px-3 sm:py-2 sm:text-sm">
                <SiteIcon name="banknote" size={14} className="mt-0.5 shrink-0 text-[var(--brand-text)]" />
                {p.deposit.type === 'percent'
                  ? t('deposit.productPercent', { percent: p.deposit.value })
                  : t('deposit.productFixed', { amount: formatCurrency(p.deposit.value) })}
              </p>
            ) : null}

            {p.shortDescription ? (
              <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--fg-muted)] sm:mt-3 sm:text-[0.95rem]">
                {p.shortDescription}
              </p>
            ) : null}

            <VariantPicker product={p} template={specTemplate} />

            <ProductSpecs specs={p.specs} template={specTemplate} />

            <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 sm:mt-4 sm:rounded-2xl sm:p-4">
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
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-2.5 text-xs sm:mt-3 sm:pt-3 sm:text-sm">
                <button
                  type="button"
                  onClick={() => openWhatsAppPicker({ topic: 'product', productName: p.name })}
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--fg-muted)] transition hover:text-[var(--brand-text)]"
                >
                  <WhatsAppIcon size={14} />
                  {t('contact.whatsapp')}
                </button>
                <HelpLink guide="order" label={t('help.ctxOrder')} className="text-xs sm:text-sm" />
              </div>
            </div>

            <ul className="mt-2.5 flex flex-wrap gap-1.5 sm:mt-3 sm:gap-2">
              {proofChips.map(({ icon, label }) => (
                <li
                  key={label}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-2 text-[10px] font-medium text-[var(--fg)] sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-xs"
                >
                  <SiteIcon name={icon} size={12} className="text-[var(--brand-text)] sm:size-3.5" />
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {p.description?.trim() ? (
        <div
          {...fade(0.12)}
          className="mt-5 sm:mt-8"
        >
          <section
            aria-labelledby="product-description-heading"
            className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 shadow-soft sm:rounded-[1.35rem] sm:p-7"
          >
            <span className="absolute inset-y-0 start-0 w-1 bg-[var(--brand)]" aria-hidden="true" />
            <h2
              id="product-description-heading"
              className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-[var(--fg)] sm:gap-2.5 sm:text-2xl"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--brand)]/15 text-[var(--brand-text)] sm:h-9 sm:w-9 sm:rounded-xl">
                <SiteIcon name="package" size={15} />
              </span>
              {t('productPage.description')}
            </h2>
            <p className="mt-2.5 max-w-4xl whitespace-pre-wrap text-[13px] leading-6 text-[var(--fg)] sm:mt-4 sm:text-base sm:font-medium sm:leading-8">
              {p.description}
            </p>
          </section>
        </div>
        ) : null}

        <CompleteSetup productId={p._id} />
        <SimilarProducts product={p} categorySlug={category?.slug} />
      </Container>

      {/* Mobile sticky buy bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-3 py-2 backdrop-blur-md pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2">
          <Button
            onClick={onAddCart}
            disabled={outOfStock}
            variant="outline"
            className="h-10 min-w-0 flex-1 gap-1.5 whitespace-nowrap rounded-full px-3 text-xs"
          >
            <SiteIcon name="cart" size={14} />
            {t('common.addToCart')}
          </Button>
          <Button
            onClick={onBuyNow}
            disabled={outOfStock}
            className="h-10 min-w-0 flex-1 whitespace-nowrap rounded-full px-3 text-xs"
          >
            {t('productPage.buyNow')}
          </Button>
        </div>
      </div>
    </>
  )
}
