import { Link, useNavigate } from 'react-router-dom'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Container } from '@/components/ui/Container'
import { EmptyState } from '@/components/ui/EmptyState'
import { QuantityStepper } from '@/components/product/QuantityStepper'
import { PageHero } from '@/components/layout/PageHero'
import { pillGhost, pillPrimary, surfaceCard } from '@/components/layout/pageStyles'
import { useCartStore } from '@/store/cartStore'
import { formatCurrency } from '@/lib/format'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useT } from '@/hooks/useT'

export function Cart() {
  const t = useT()
  usePageTitle(t('cart.title'))
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const updateQty = useCartStore((s) => s.updateQty)
  const removeItem = useCartStore((s) => s.removeItem)
  const subtotal = useCartStore((s) => s.subtotal())

  if (!items.length) {
    return (
      <>
        <PageHero
          kicker={t('cart.kicker')}
          title={t('cart.heading')}
          description={t('cart.emptyHero')}
        />
        <Container className="py-10">
          <EmptyState
            title={t('cart.emptyTitle')}
            description={t('cart.emptyBody')}
            actionLabel={t('common.shopNow')}
            onAction={() => navigate('/shop')}
          />
        </Container>
      </>
    )
  }

  return (
    <>
      <PageHero
        kicker={t('cart.kicker')}
        title={t('cart.heading')}
        description={
          items.length === 1
            ? t('cart.itemCod', { count: items.length })
            : t('cart.itemsCod', { count: items.length })
        }
      />
      <Container className="py-8 sm:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.productId} className={`${surfaceCard} flex flex-col gap-4 p-4 sm:flex-row sm:items-center`}>
                <Link
                  to={`/product/${item.slug}`}
                  className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-[var(--bg-muted)]"
                >
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                  ) : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${item.slug}`}
                    className="font-display font-semibold hover:text-[var(--brand-text)]"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-sm text-[var(--fg-muted)]">{formatCurrency(item.price)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <QuantityStepper
                      value={item.qty}
                      max={item.stock}
                      onChange={(qty) => updateQty(item.productId, qty)}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm text-[var(--fg-muted)] transition hover:text-[var(--danger)]"
                    >
                      <SiteIcon name="trash" size={16} />
                      {t('ui.remove')}
                    </button>
                  </div>
                </div>
                <p className="font-display font-semibold sm:text-right">
                  {formatCurrency(item.price * item.qty)}
                </p>
              </div>
            ))}
          </div>

          <aside className={`${surfaceCard} h-fit p-6 lg:sticky lg:top-[calc(var(--nav-height)+0.75rem)]`}>
            <h2 className="font-display text-lg font-semibold">{t('cart.summary')}</h2>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-[var(--fg-muted)]">{t('cart.subtotal')}</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <ul className="mt-4 space-y-2 text-xs text-[var(--fg-muted)]">
              <li className="flex items-center gap-2">
                <SiteIcon name="package-check" size={14} className="text-[var(--brand)]" />
                {t('cart.payCourier')}
              </li>
              <li className="flex items-center gap-2">
                <SiteIcon name="shield" size={14} className="text-[var(--brand)]" />
                {t('cart.warrantyFromDelivery')}
              </li>
            </ul>
            <p className="mt-3 text-xs text-[var(--fg-muted)]">
              {t('cart.shippingHint')}
            </p>
            <Link to="/checkout" className={`${pillPrimary} mt-6 w-full`}>
              {t('cart.checkout')}
            </Link>
            <Link to="/shop" className={`${pillGhost} mt-3 w-full bg-[var(--bg)] text-sm dark:bg-white/5`}>
              {t('cart.continueShopping')}
            </Link>
          </aside>
        </div>
      </Container>
    </>
  )
}
