import type { HelpGuideId } from './types'

/**
 * The step-by-step guide that answers the question a customer most likely has on this page
 * (the Help button opens it directly). null: show the list of guides.
 * `pathname` is without the language prefix (/fr, /ar).
 */
export function guideForPath(pathname: string): HelpGuideId | null {
  const p = pathname.replace(/\/+$/, '') || '/'
  if (p === '/cart' || p === '/checkout' || p.startsWith('/product/')) return 'order'
  if (p === '/track-order' || p.startsWith('/account/orders') || p.startsWith('/order-confirmation/')) return 'track'
  if (p === '/services/returns' || p === '/services/warranty' || p === '/services/repair') return 'return'
  if (p === '/services/cash-on-delivery') return 'pay'
  if (p === '/services/home-delivery') return 'track'
  if (p === '/account' || p === '/account/settings') return 'account'
  return null
}

/**
 * Where the shopper is in "How to order" (steps: find, add to cart, details, place the order):
 * products in the cart → details next; a product page → add it; the shop → find one.
 */
export function orderStepFor(pathname: string, itemsInCart: number): number | undefined {
  if (pathname.startsWith('/checkout') || itemsInCart > 0) return 2
  if (pathname.startsWith('/product/')) return 1
  if (/^\/(shop|category|search)(\/|$)/.test(pathname) || pathname === '/') return 0
  return undefined
}
