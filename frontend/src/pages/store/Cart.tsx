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
import { cn } from '@/lib/cn'

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
        <Container className="py-5 sm:py-10">
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
      >
        <Link
          to="/shop"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] px-3 text-xs font-medium text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
        >
          {t('cart.continueShopping')}
          <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
        </Link>
      </PageHero>

      <Container className="pb-28 pt-5 sm:py-10 lg:pb-10">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-8">
          <div className="space-y-3 sm:space-y-4">
            {items.map((item) => (
              <div
                key={item.productId}
                className={cn(surfaceCard, 'flex gap-3 p-3 sm:gap-4 sm:p-4')}
              >
                <Link
                  to={`/product/${item.slug}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-muted)] sm:h-24 sm:w-24 sm:rounded-2xl"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      to={`/product/${item.slug}`}
                      className="line-clamp-2 font-display text-sm font-semibold hover:text-[var(--brand-text)] sm:text-base"
                    >
                      {item.name}
                    </Link>
                    <p className="shrink-0 font-display text-sm font-semibold sm:text-base">
                      {formatCurrency(item.price * item.qty)}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--fg-muted)] sm:text-sm">
                    {formatCurrency(item.price)}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 sm:mt-3 sm:gap-3">
                    <QuantityStepper
                      value={item.qty}
                      max={item.stock}
                      onChange={(qty) => updateQty(item.productId, qty)}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.productId)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full px-2 text-xs text-[var(--fg-muted)] transition hover:text-[var(--danger)] sm:text-sm"
                    >
                      <SiteIcon name="trash" size={14} />
                      {t('ui.remove')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <aside
            className={cn(
              surfaceCard,
              'hidden h-fit p-5 sm:block sm:p-6 lg:sticky lg:top-[calc(var(--nav-height)+0.75rem)]'
            )}
          >
            <h2 className="font-display text-lg font-semibold">{t('cart.summary')}</h2>
            <div className="mt-4 flex justify-between text-sm">
              <span className="text-[var(--fg-muted)]">{t('cart.subtotal')}</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </div>
            <ul className="mt-4 space-y-2 text-xs text-[var(--fg-muted)]">
              <li className="flex items-center gap-2">
                <SiteIcon name="package-check" size={14} className="text-[var(--brand-text)]" />
                {t('cart.payCourier')}
              </li>
              <li className="flex items-center gap-2">
                <SiteIcon name="shield" size={14} className="text-[var(--brand-text)]" />
                {t('cart.warrantyFromDelivery')}
              </li>
            </ul>
            <Link to="/checkout" className={cn(pillPrimary, 'mt-6 w-full text-sm sm:text-base')}>
              {t('cart.checkout')}
            </Link>
            <Link
              to="/shop"
              className={cn(pillGhost, 'mt-3 w-full bg-[var(--bg)] text-sm dark:bg-white/5')}
            >
              {t('cart.continueShopping')}
            </Link>
          </aside>
        </div>
      </Container>

      {/* Mobile sticky checkout */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-[var(--fg-muted)]">{t('cart.subtotal')}</p>
            <p className="font-display text-base font-semibold">{formatCurrency(subtotal)}</p>
          </div>
          <Link to="/checkout" className={cn(pillPrimary, 'h-11 flex-1 px-4 text-sm')}>
            {t('cart.checkout')}
          </Link>
        </div>
      </div>
    </>
  )
}
