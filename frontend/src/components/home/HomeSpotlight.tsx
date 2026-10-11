import { Link } from 'react-router-dom'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
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

const SPEC_ICON: Record<string, SiteIconName> = {
  cpu: 'cpu',
  ram_gb: 'layers',
  capacity_gb: 'layers',
  storage: 'boxes',
  gpu: 'gamepad',
  screen_size: 'monitor',
  resolution: 'monitor',
  refresh_rate: 'monitor',
}

/** Up to `max` headline specs (the template's important ones, in order), formatted for display. */
function keySpecs(p: Product, locale: ReturnType<typeof useLocaleStore.getState>['locale'], max = 3) {
  const category = typeof p.category === 'object' ? (p.category as Category) : null
  const tpl = getTemplate(resolveTemplate(p.specTemplate, category))
  const specs = p.specs || {}
  return tpl.important
    .filter((k) => String(specs[k] ?? '').trim())
    .slice(0, max)
    .map((k) => ({ key: k, icon: SPEC_ICON[k] ?? 'sliders', value: formatSpecValue(k, String(specs[k]), locale) }))
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

function deal(p: Product) {
  if (p.compareAtPrice == null || p.compareAtPrice <= p.price) return null
  return { percent: Math.round((1 - p.price / p.compareAtPrice) * 100), saved: p.compareAtPrice - p.price }
}

const isLow = (p: Product) => p.stock > 0 && p.stock <= (p.lowStockThreshold ?? 5)

/** Warm "−14%" sticker: the one warm colour on the cool hero, so the eye lands on the deal. */
function DealSticker({ percent, className }: { percent: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 font-display font-bold text-white shadow-[0_8px_24px_-6px_rgb(244_63_94/0.7)] ring-2 ring-white/25',
        className
      )}
    >
      −{percent}%
    </span>
  )
}

/** Pulsing dot + "Only 3 left" / "In stock". */
function StockLine({ product, className }: { product: Product; className?: string }) {
  const t = useT()
  const low = isLow(product)
  return (
    <span className={cn('inline-flex items-center gap-1.5 font-medium', low ? 'text-amber-300' : 'text-emerald-300', className)}>
      <span className="relative flex h-2 w-2">
        <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping', low ? 'bg-amber-400' : 'bg-emerald-400')} />
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', low ? 'bg-amber-400' : 'bg-emerald-400')} />
      </span>
      {low ? t('stock.onlyLeft', { count: product.stock }) : t('stock.inStock')}
    </span>
  )
}

/** Desktop: the product beside the headline — glowing, floating, with the deal and stock up front. */
export function HomeSpotlightCard({ product }: { product: Product }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const src = sizedImageUrl(image, 960)
  const photo = useImageLoaded(src)
  const contain = imageFit(image) === 'contain'
  const d = deal(product)
  const brand = typeof product.brand === 'object' ? product.brand?.name : undefined
  const specs = keySpecs(product, locale)
  const href = `/product/${product.slug}`

  return (
    <div className="relative motion-safe:animate-[spotlight-float_7s_ease-in-out_infinite]">
      {/* Halo */}
      <div
        className="pointer-events-none absolute -inset-8 rounded-[3rem] bg-[radial-gradient(closest-side,rgb(0_194_255/0.5),rgb(251_146_60/0.12)_70%,transparent)] blur-2xl"
        aria-hidden="true"
      />

      {d ? <DealSticker percent={d.percent} className="absolute -end-4 -top-4 z-20 h-16 w-16 rotate-12 text-lg" /> : null}

      {/* Rotating light on the border */}
      <div className="group relative overflow-hidden rounded-[1.6rem] p-[1.5px] shadow-[0_30px_80px_-24px_rgb(0_0_0/0.8)] transition duration-300 hover:-translate-y-1">
        <div
          className="absolute inset-[-60%] bg-[conic-gradient(from_0deg,transparent_0deg,var(--brand)_70deg,transparent_140deg,transparent_200deg,rgb(251_146_60)_260deg,transparent_320deg)] motion-safe:animate-[spotlight-spin_9s_linear_infinite]"
          aria-hidden="true"
        />

        <article className="relative overflow-hidden rounded-[1.5rem] bg-[#0b1116]/95 text-white backdrop-blur-xl">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_50%_0%,rgb(0_194_255/0.28),transparent_70%)]"
            aria-hidden="true"
          />

          <Link to={href} className="relative block p-3 pb-0" tabIndex={-1} aria-hidden="true">
            <div
              ref={photo.ref}
              className={cn(
                'relative aspect-[5/4] overflow-hidden rounded-[1.1rem]',
                contain ? 'bg-[radial-gradient(circle_at_50%_40%,#ffffff,#e9eef3)]' : 'bg-white/5'
              )}
            >
              {photo.loaded ? null : <div className="absolute inset-0 animate-pulse bg-white/10" />}
              <SafeImage
                src={src}
                srcSet={imageSrcSet(image, [480, 640, 960, 1280])}
                sizes="26rem"
                alt=""
                width={960}
                height={768}
                referrerPolicy="no-referrer"
                onLoad={photo.onLoad}
                onError={photo.onError}
                className={cn(
                  'absolute inset-0 h-full w-full max-w-none transition duration-700 ease-out group-hover:scale-[1.06]',
                  contain ? 'object-contain p-6 drop-shadow-[0_18px_20px_rgb(0_0_0/0.25)]' : 'object-cover',
                  photo.loaded ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span className="absolute start-3 top-3 inline-flex h-7 items-center gap-1.5 rounded-full bg-black/55 px-3 text-[11px] font-semibold backdrop-blur-md">
                <SiteIcon name="star" size={12} solid className="text-amber-300" />
                {d ? t('home.spotlightDeal') : t('product.featuredPick')}
              </span>
            </div>
          </Link>

          <div className="relative space-y-3.5 p-4 pt-3.5">
            <div className="min-w-0">
              {brand ? <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand)]">{brand}</p> : null}
              <Link to={href} className="mt-0.5 line-clamp-2 font-display text-lg font-semibold leading-snug hover:text-[var(--brand)]">
                {product.name}
                {product.variantLabel ? <span className="font-normal text-white/60"> · {product.variantLabel}</span> : null}
              </Link>
              {specs.length ? (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {specs.map((s) => (
                    <li
                      key={s.key}
                      className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] text-white/85"
                    >
                      <SiteIcon name={s.icon} size={12} className="shrink-0 text-[var(--brand)]" />
                      <span className="truncate">{s.value}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex items-end justify-between gap-3 border-t border-white/10 pt-3">
              <div className="leading-tight">
                <p className="flex items-baseline gap-2">
                  <span className="font-display text-[1.75rem] font-bold tracking-tight">{formatCurrency(product.price)}</span>
                  {d ? <span className="text-sm text-white/45 line-through">{formatCurrency(product.compareAtPrice!)}</span> : null}
                </p>
                {d ? (
                  <p className="mt-1 inline-flex rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    {t('home.spotlightSave', { amount: formatCurrency(d.saved) })}
                  </p>
                ) : null}
              </div>
              <div className="space-y-1 text-end text-[11px]">
                <StockLine product={product} className="justify-end" />
                <p className="flex items-center justify-end gap-1 text-white/60">
                  <SiteIcon name="banknote" size={12} />
                  {t('deposit.payOnDelivery')}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={add}
                className="relative inline-flex h-11 flex-1 items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--brand)] px-4 text-sm font-semibold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <span
                  className="pointer-events-none absolute inset-y-0 start-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent motion-safe:animate-[spotlight-shine_3.2s_ease-in-out_infinite]"
                  aria-hidden="true"
                />
                <SiteIcon name="cart" size={16} />
                {t('common.addToCart')}
              </button>
              <Link
                to={href}
                aria-label={t('product.viewProduct')}
                title={t('product.viewProduct')}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-white transition hover:border-[var(--brand)] hover:bg-white/5 hover:text-[var(--brand)]"
              >
                <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  )
}

/** Phones and tablets: a glowing strip under the hero buttons (keeps them above the fold). */
export function HomeSpotlightStrip({ product }: { product: Product }) {
  const t = useT()
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const contain = imageFit(image) === 'contain'
  const d = deal(product)

  return (
    <div className="relative overflow-hidden rounded-2xl p-px shadow-[0_16px_40px_-16px_rgb(0_194_255/0.55)]">
      <div
        className="absolute inset-[-150%] bg-[conic-gradient(from_0deg,transparent_0deg,var(--brand)_70deg,transparent_140deg,transparent_200deg,rgb(251_146_60)_260deg,transparent_320deg)] motion-safe:animate-[spotlight-spin_9s_linear_infinite]"
        aria-hidden="true"
      />
      <div className="relative flex min-w-0 items-center gap-3 rounded-[15px] bg-[#0b1116]/92 p-2 pe-2.5 text-white backdrop-blur-xl">
        <Link to={`/product/${product.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className={cn(
              'relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl',
              contain ? 'bg-[radial-gradient(circle_at_50%_40%,#ffffff,#e9eef3)]' : 'bg-white/10'
            )}
          >
            {image ? (
              <SafeImage
                src={sizedImageUrl(image, 160)}
                alt=""
                width={64}
                height={64}
                referrerPolicy="no-referrer"
                className={cn('h-full w-full', contain ? 'object-contain p-1' : 'object-cover')}
              />
            ) : (
              <SiteIcon name="package" size={18} />
            )}
            {d ? (
              <span className="absolute bottom-0.5 start-0.5 rounded-md bg-gradient-to-br from-amber-400 to-rose-500 px-1 text-[10px] font-bold leading-4 text-white">
                −{d.percent}%
              </span>
            ) : null}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--brand)]">
              <SiteIcon name="star" size={10} solid className="text-amber-300" />
              {d ? t('home.spotlightDeal') : t('product.featuredPick')}
            </span>
            <span className="block truncate text-sm font-semibold">{product.name}</span>
            <span className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
              <span className="font-bold">{formatCurrency(product.price)}</span>
              {d ? <span className="text-[11px] text-white/50 line-through">{formatCurrency(product.compareAtPrice!)}</span> : null}
              {isLow(product) ? <StockLine product={product} className="text-[11px]" /> : null}
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={add}
          aria-label={t('common.addToCart')}
          className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <SiteIcon name="cart" size={17} />
        </button>
      </div>
    </div>
  )
}

/** Same footprint as the card while the product loads, so the hero does not jump. */
export function HomeSpotlightSkeleton({ strip }: { strip?: boolean }) {
  return strip ? (
    <div className="h-[5rem] animate-pulse rounded-2xl border border-white/10 bg-white/10" aria-hidden="true" />
  ) : (
    <div className="overflow-hidden rounded-[1.6rem] border border-white/10 bg-white/10 p-3" aria-hidden="true">
      <div className="aspect-[5/4] animate-pulse rounded-[1.1rem] bg-white/10" />
      <div className="h-52 animate-pulse" />
    </div>
  )
}
