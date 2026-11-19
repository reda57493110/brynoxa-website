import { Link } from 'react-router-dom'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { withProductText } from '@/lib/productText'
import { useLocaleStore } from '@/store/localeStore'
import type { Product } from '@/types'
import { deal, keySpecs, StockLine, useAddToCart } from '@/components/home/HomeSpotlight'
import { useFreeDelivery } from '@/components/home/HomeShopCard'

function primaryImage(p: Product) {
  return p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url || undefined
}

/**
 * List view of the shop (the big shops' long rows): photo, name, the key specs as a small table,
 * then price, stock, cash on delivery / delivery, Add to cart and See.
 */
export function ShopListCard({ product, eager = false }: { product: Product; eager?: boolean }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const add = useAddToCart(product)
  const image = primaryImage(product)
  const contain = imageFit(image) === 'contain'
  const d = deal(product)
  const brand = typeof product.brand === 'object' ? product.brand?.name : undefined
  const specs = keySpecs(product, locale, 5)
  const blurb = withProductText(product, locale).shortDescription?.trim()
  const free = useFreeDelivery()(product.price)
  const href = `/product/${product.slug}`

  return (
    <article className="group grid grid-cols-[8.5rem_minmax(0,1fr)] gap-x-3 gap-y-2.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2.5 transition hover:border-[rgb(0_194_255/0.6)] sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5 sm:p-4 lg:grid-cols-[12rem_minmax(0,1fr)_15rem]">
      <Link to={href} tabIndex={-1} aria-hidden="true" className={cn('relative block aspect-square self-start overflow-hidden rounded-xl', contain ? 'photo-stage' : 'bg-[#0b1116]')}>
        {image ? (
          <SafeImage
            src={sizedImageUrl(image, 480)}
            alt=""
            width={240}
            height={240}
            loading={eager ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            className={cn('absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105', contain ? 'object-contain p-1.5 mix-blend-multiply sm:p-3' : 'object-cover')}
          />
        ) : null}
        {d ? <span className="absolute start-2 top-2 rounded-md bg-[var(--brand)] px-1.5 py-0.5 text-[11px] font-extrabold text-[var(--brand-fg)]">-{d.percent}%</span> : null}
      </Link>

      <div className="min-w-0">
        {brand ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{brand}</p> : null}
        <h3 className="mt-0.5 line-clamp-2 text-[12px] font-extrabold uppercase leading-snug tracking-tight sm:line-clamp-none sm:text-base">
          <Link to={href} className="hover:text-[var(--brand-text)]">
            {product.name}
            {product.variantLabel ? <span className="font-medium normal-case text-[var(--fg-muted)]"> · {product.variantLabel}</span> : null}
          </Link>
        </h3>
        {specs.length ? (
          <ul className="mt-1.5 grid gap-y-0.5 text-[11px] sm:mt-2.5 sm:gap-y-1 sm:text-[12.5px]">
            {specs.map((s) => (
              <li key={s.key} className="flex min-w-0 items-center gap-2 [&:nth-child(n+4)]:max-sm:hidden">
                <SiteIcon name={s.icon} size={13} className="shrink-0 text-[var(--brand-text)]" />
                <span className="truncate text-[var(--fg)]">{s.value}</span>
              </li>
            ))}
          </ul>
        ) : blurb ? (
          <p className="mt-2 line-clamp-3 text-[13px] text-[var(--fg-muted)]">{blurb}</p>
        ) : null}
        <Link to={href} className="mt-2 hidden text-xs font-bold text-[var(--brand-text)] hover:underline sm:inline-block">
          {t('shop.seeDetails')}
        </Link>
      </div>

      <div className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-3 gap-y-1 border-t border-[var(--border)] pt-2.5 sm:flex sm:flex-col sm:items-stretch sm:gap-2.5 sm:pt-3 lg:col-span-1 lg:border-s lg:border-t-0 lg:ps-5 lg:pt-0">
        <div className="col-start-1 leading-tight">
          {d ? <p className="text-xs text-[var(--fg-muted)] line-through">{formatCurrency(product.compareAtPrice!)}</p> : null}
          <p className="font-display text-lg font-extrabold tracking-tight text-[var(--brand)] sm:text-2xl">{formatCurrency(product.price)}</p>
          {d ? <p className="mt-1 hidden rounded-md sm:inline-flex bg-[rgb(0_194_255/0.14)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--brand-text)]">{t('home.spotlightSave', { amount: formatCurrency(d.saved) })}</p> : null}
        </div>
        <StockLine product={product} className="col-start-1 text-[11px] sm:text-xs" />
        <ul className="hidden grid-cols-2 gap-1.5 text-[11px] sm:grid lg:grid-cols-1">
          <li className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2 py-1.5">
            <SiteIcon name="banknote" size={14} className="shrink-0 text-[var(--brand-text)]" />
            <span className="truncate">{t('home.trustCodTitle')}</span>
          </li>
          <li className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2 py-1.5">
            <SiteIcon name="truck" size={14} className="shrink-0 text-[var(--brand-text)]" />
            <span className="truncate">{free ? t('home.freeDelivery') : t('home.trustDeliveryTitle')}</span>
          </li>
        </ul>
        {/* Phones: on the right of the price */}
        <div className="col-start-2 row-span-2 row-start-1 flex gap-2 self-center sm:mt-auto">
          <button
            type="button"
            onClick={add}
            className="btn-shine inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-[13px] font-bold sm:h-10 sm:text-sm text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-[0.98]"
          >
            <SiteIcon name="cart" size={16} />
            {t('common.addToCart')}
          </button>
          <Link to={href} aria-label={t('product.viewProduct')} title={t('product.viewProduct')} className="grid size-10 shrink-0 place-items-center rounded-xl border border-[var(--border)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]">
            <SiteIcon name="arrow-right" size={16} className="rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </article>
  )
}
