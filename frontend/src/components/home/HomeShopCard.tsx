import { Link } from 'react-router-dom'
import { ImageSpinner } from '@/components/ui/ImageLoader'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useImageLoaded } from '@/hooks/useImageLoaded'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, imageSrcSet, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { useLocaleStore } from '@/store/localeStore'
import type { Product } from '@/types'
import { deal, keySpecs, StockLine, useAddToCart } from './HomeSpotlight'

/** The sticker in the photo's corner: a discount, "New" or "Top" */
export type CardBadge = 'deal' | 'new' | 'top' | null

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

/**
 * Home product card, in the style of the big Moroccan PC shops: sticker, photo on a light stage,
 * brand, name, three key specs, stock, old price and price, and a square cart button.
 * The whole card opens the product; the cart button adds it.
 */
export function HomeShopCard({ product, badge = null, eager = false }: { product: Product; badge?: CardBadge; eager?: boolean }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const src = sizedImageUrl(image, 480)
  const photo = useImageLoaded(src)
  const contain = imageFit(image) === 'contain'
  const d = deal(product)
  const brand = typeof product.brand === 'object' ? product.brand?.name : undefined
  const specs = keySpecs(product, locale, 3)
  const href = `/product/${product.slug}`
  const sticker = badge === 'deal' || (badge === null && d) ? (d ? `-${d.percent}%` : null) : badge === 'new' ? t('home.badgeNew') : badge === 'top' ? t('home.badgeTop') : null

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] transition duration-300 hover:-translate-y-0.5 hover:border-[rgb(0_194_255/0.6)] hover:shadow-[0_18px_40px_-24px_rgb(0_194_255/0.7)]">
      <div ref={photo.ref} className={cn('relative aspect-square overflow-hidden', contain ? 'photo-stage' : 'bg-[#0b1116]')}>
        {photo.loaded ? null : <ImageSpinner size="sm" tone={contain ? 'auto' : 'dark'} />}
        <SafeImage
          src={src}
          srcSet={imageSrcSet(image, [320, 480, 640])}
          sizes="(min-width: 1280px) 15rem, (min-width: 640px) 30vw, 46vw"
          alt=""
          width={480}
          height={480}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={photo.onLoad}
          onError={photo.onError}
          className={cn(
            'absolute inset-0 h-full w-full transition duration-500 group-hover:scale-[1.05]',
            contain ? 'object-contain p-3 mix-blend-multiply sm:p-4' : 'object-cover',
            photo.loaded ? 'opacity-100' : 'opacity-0'
          )}
        />
        {sticker ? (
          <span
            className={cn(
              'absolute start-2 top-2 z-10 rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow sm:start-2.5 sm:top-2.5 sm:px-2 sm:text-[11px]',
              badge === 'new' ? 'bg-white text-[#05080b]' : 'bg-[var(--brand)] text-[var(--brand-fg)]'
            )}
          >
            {sticker}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3.5">
        {brand ? <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)] sm:text-[11px]">{brand}</p> : null}
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.5em] text-[12.5px] font-bold uppercase leading-[1.25] tracking-tight text-[var(--fg)] sm:text-sm">
          <Link to={href} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
            {product.name}
            {product.variantLabel ? <span className="font-medium normal-case text-[var(--fg-muted)]"> · {product.variantLabel}</span> : null}
          </Link>
        </h3>
        {specs.length ? (
          <ul className="mt-2 hidden flex-wrap gap-1 sm:flex">
            {specs.map((s) => (
              <li key={s.key} className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--fg-muted)]">
                <SiteIcon name={s.icon} size={11} className="shrink-0 text-[var(--brand-text)]" />
                <span className="truncate">{s.value}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <StockLine product={product} className="mt-2 text-[11px]" />
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div className="min-w-0 leading-tight">
            {d ? <p className="truncate text-[11px] text-[var(--fg-muted)] line-through sm:text-xs">{formatCurrency(product.compareAtPrice!)}</p> : null}
            <p className="truncate font-display text-base font-extrabold tracking-tight text-[var(--brand)] sm:text-lg">{formatCurrency(product.price)}</p>
          </div>
          <button
            type="button"
            onClick={add}
            aria-label={`${t('common.addToCart')}: ${product.name}`}
            title={t('common.addToCart')}
            className="relative z-10 grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:size-10"
          >
            <SiteIcon name="cart" size={17} />
          </button>
        </div>
      </div>
    </article>
  )
}
