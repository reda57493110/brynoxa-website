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
    <article className="group grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 transition hover:border-[rgb(0_194_255/0.6)] sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5 sm:p-4 lg:grid-cols-[12rem_minmax(0,1fr)_15rem]">
      <Link to={href} tabIndex={-1} aria-hidden="true" className={cn('relative block aspect-[4/3] overflow-hidden rounded-xl sm:aspect-square', contain ? 'photo-stage' : 'bg-[#0b1116]')}>
        {image ? (
          <SafeImage
            src={sizedImageUrl(image, 480)}
            alt=""
            width={240}
            height={240}
            loading={eager ? 'eager' : 'lazy'}
            referrerPolicy="no-referrer"
            className={cn('absolute inset-0 h-full w-full transition duration-500 group-hover:scale-105', contain ? 'object-contain p-3 mix-blend-multiply' : 'object-cover')}
          />
        ) : null}
        {d ? <span className="absolute start-2 top-2 rounded-md bg-[var(--brand)] px-1.5 py-0.5 text-[11px] font-extrabold text-[var(--brand-fg)]">-{d.percent}%</span> : null}
      </Link>

      <div className="min-w-0">
        {brand ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">{brand}</p> : null}
        <h3 className="mt-0.5 text-sm font-extrabold uppercase leading-snug tracking-tight sm:text-base">
          <Link to={href} className="hover:text-[var(--brand-text)]">
            {product.name}
            {product.variantLabel ? <span className="font-medium normal-case text-[var(--fg-muted)]"> · {product.variantLabel}</span> : null}
          </Link>
        </h3>
        {specs.length ? (
          <ul className="mt-2.5 grid gap-y-1 text-[12.5px]">
            {specs.map((s) => (
              <li key={s.key} className="flex min-w-0 items-center gap-2">
                <SiteIcon name={s.icon} size={13} className="shrink-0 text-[var(--brand-text)]" />
                <span className="truncate text-[var(--fg)]">{s.value}</span>
              </li>
            ))}
          </ul>
        ) : blurb ? (
          <p className="mt-2 line-clamp-3 text-[13px] text-[var(--fg-muted)]">{blurb}</p>
        ) : null}
        <Link to={href} className="mt-2 inline-block text-xs font-bold text-[var(--brand-text)] hover:underline">
          {t('shop.seeDetails')}
        </Link>
      </div>

      <div className="flex flex-col gap-2.5 border-t border-[var(--border)] pt-3 sm:col-span-2 lg:col-span-1 lg:border-s lg:border-t-0 lg:ps-5 lg:pt-0">
        <div className="leading-tight">
          {d ? <p className="text-xs text-[var(--fg-muted)] line-through">{formatCurrency(product.compareAtPrice!)}</p> : null}
          <p className="font-display text-2xl font-extrabold tracking-tight text-[var(--brand)]">{formatCurrency(product.price)}</p>
          {d ? <p className="mt-1 inline-flex rounded-md bg-[rgb(0_194_255/0.14)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--brand-text)]">{t('home.spotlightSave', { amount: formatCurrency(d.saved) })}</p> : null}
        </div>
        <StockLine product={product} className="text-xs" />
        <ul className="grid grid-cols-2 gap-1.5 text-[11px] lg:grid-cols-1">
          <li className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2 py-1.5">
            <SiteIcon name="banknote" size={14} className="shrink-0 text-[var(--brand-text)]" />
            <span className="truncate">{t('home.trustCodTitle')}</span>
          </li>
          <li className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-muted)] px-2 py-1.5">
            <SiteIcon name="truck" size={14} className="shrink-0 text-[var(--brand-text)]" />
            <span className="truncate">{free ? t('home.freeDelivery') : t('home.trustDeliveryTitle')}</span>
          </li>
        </ul>
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={add}
            className="btn-shine inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-3 text-sm font-bold text-[var(--brand-fg)] shadow-glow transition hover:brightness-110 active:scale-[0.98]"
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
