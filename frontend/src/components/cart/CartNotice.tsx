import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { useT } from '@/hooks/useT'
import { formatCurrency } from '@/lib/format'
import { imageFit, sizedImageUrl } from '@/lib/image'
import { cn } from '@/lib/cn'
import { useCartStore } from '@/store/cartStore'

const SHOW_MS = 6000

/**
 * "Added to cart" panel: appears wherever the shopper is on the page after tapping Add, with the
 * product, the cart total and direct Checkout / View cart links — no need to scroll back up.
 * Bottom sheet on phones, top-right card under the header on larger screens.
 */
export function CartNotice() {
  const t = useT()
  const { pathname } = useLocation()
  const lastAdded = useCartStore((s) => s.lastAdded)
  const dismiss = useCartStore((s) => s.dismissAdded)
  const items = useCartStore((s) => s.items)
  const [paused, setPaused] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onCartPages = pathname.startsWith('/cart') || pathname.startsWith('/checkout')
  const item = lastAdded ? items.find((i) => i.productId === lastAdded.productId) : undefined
  const open = Boolean(lastAdded && item && !onCartPages)

  // Auto-hide; restarts on every new add, paused while hovered or focused
  useEffect(() => {
    if (!open || paused) return
    timer.current = setTimeout(dismiss, SHOW_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [open, paused, lastAdded?.at, dismiss])

  // Leaving the page closes it
  useEffect(() => {
    dismiss()
  }, [pathname, dismiss])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, dismiss])

  if (!open || !item) return null

  const count = items.reduce((n, i) => n + i.qty, 0)
  const total = items.reduce((n, i) => n + i.price * i.qty, 0)
  const fit = imageFit(item.image)

  return (
    <div
      key={lastAdded?.at}
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'cart-notice fixed z-[95] rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 text-[var(--fg)] shadow-soft',
        'inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))]',
        'sm:inset-x-auto sm:bottom-auto sm:end-6 sm:top-24 sm:w-[26rem] sm:p-5 lg:end-12 lg:w-[30rem]'
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_22%,transparent)] text-[var(--success)]">
          <SiteIcon name="check" size={12} className="sm:scale-125" />
        </span>
        <p className="text-sm font-semibold sm:text-base">{t('product.addedToCart')}</p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t('ui.close')}
          className="ms-auto flex h-7 w-7 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
        >
          <SiteIcon name="close" size={14} />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-3 sm:mt-4 sm:gap-4">
        <span className={cn('h-12 w-12 shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-20 sm:rounded-xl', fit === 'contain' ? 'bg-white' : 'bg-[var(--bg-muted)]')}>
          {item.image ? (
            <SafeImage
              src={sizedImageUrl(item.image, 240)}
              alt=""
              referrerPolicy="no-referrer"
              className={cn('h-full w-full', fit === 'contain' ? 'object-contain p-1 mix-blend-multiply' : 'object-cover')}
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium sm:line-clamp-2 sm:whitespace-normal sm:text-base sm:font-semibold">{item.name}</p>
          <p className="text-xs tabular-nums text-[var(--fg-muted)] sm:mt-0.5 sm:text-sm">
            {item.qty} × {formatCurrency(item.price)}
          </p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2 text-xs sm:mt-4 sm:pt-3 sm:text-sm">
        <span className="text-[var(--fg-muted)]">
          {t('cart.cartTotal')} · {t('cart.itemsInCart', { count })}
        </span>
        <span className="font-semibold tabular-nums sm:text-lg">{formatCurrency(total)}</span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
        <Link
          to="/cart"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full sm:h-11 sm:text-base border border-[var(--border)] text-sm font-medium hover:border-[var(--brand)]"
        >
          <SiteIcon name="cart" size={14} /> {t('cart.viewCart')}
        </Link>
        <Link
          to="/checkout"
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full sm:h-11 sm:text-base bg-[var(--brand)] text-sm font-semibold text-[var(--brand-fg)] hover:opacity-90"
        >
          {t('cart.checkout')} <SiteIcon name="arrow-right" size={14} className="rtl:rotate-180" />
        </Link>
      </div>
    </div>
  )
}
