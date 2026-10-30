// Relative import: also loaded by tests (tests/translations.test.mts)
import { translate, type Locale, type MessageKey } from '../i18n'

/**
 * The server answers in English. In the shop, the messages a customer can meet are shown in
 * their language; anything not listed here (and the English-only admin) keeps the server text.
 */
const EXACT: Record<string, MessageKey> = {
  'Invalid email or password': 'server.invalidLogin',
  'Account temporarily locked. Try again later.': 'server.locked',
  'Too many wrong passwords. Please wait 15 minutes and try again.': 'server.locked',
  'Account is disabled': 'server.disabled',
  'Please verify your email before signing in': 'server.verifyFirst',
  'Email already registered': 'server.emailTaken',
  'Email already registered — please sign in': 'server.emailTaken',
  'An account exists with this email — please sign in': 'server.emailTaken',
  'This email is already registered': 'server.emailTaken',
  'Session expired': 'server.sessionExpired',
  'Session ended after a password change — please sign in again': 'server.sessionExpired',
  'Authentication required': 'server.sessionExpired',
  'Refresh token missing': 'server.sessionExpired',
  'Invalid refresh token': 'server.sessionExpired',
  'Current password is incorrect': 'server.wrongCurrentPassword',
  'Reset link is invalid or expired': 'server.resetLinkExpired',
  'Verification link is invalid or expired': 'server.resetLinkExpired',
  'Invalid or expired token': 'server.resetLinkExpired',
  'This password is too common or was published. Please choose another one.': 'server.commonPassword',
  'Staff passwords are set by the owner — ask the owner to change yours': 'server.staffPassword',
  'Email is required to place an order': 'server.emailRequired',
  'You already ordered with this email. Please contact us to activate your account.': 'server.guestEmail',
  'Invalid coupon': 'server.couponInvalid',
  'Coupon is no longer available': 'server.couponInvalid',
  'Coupon expired': 'server.couponExpired',
  'Coupon not active yet': 'server.couponNotYet',
  'Coupon usage limit reached': 'server.couponUsedUp',
  'This coupon is for other products': 'server.couponOtherProducts',
  'You have already used this coupon': 'server.couponAlreadyUsed',
  'One or more products are unavailable': 'server.productUnavailable',
  'Product not found': 'server.productUnavailable',
  'Order not found': 'server.orderNotFound',
  'We could not find an order with those details': 'server.orderNotFound',
  'Only pending orders can be cancelled': 'server.onlyPendingCancel',
  'Only pending orders can be edited': 'server.cannotEdit',
  'This order can no longer be edited': 'server.cannotEdit',
  'Your deposit has been received. Contact us to cancel and arrange the refund.': 'server.depositReceivedCancel',
  'Too many orders from this connection. Please wait a little or contact us on WhatsApp.': 'server.tooManyOrders',
  'Too many orders for this email or phone. Please wait a little or contact us on WhatsApp.': 'server.tooManyOrders',
  'Sign in temporarily unavailable. Please try again in a moment.': 'server.signInUnavailable',
  'Something went wrong. Please try again.': 'server.generic',
  'Something went wrong': 'server.generic',
}

const PATTERNS: [RegExp, MessageKey, (m: RegExpMatchArray) => Record<string, string>][] = [
  [/^Too many .*(try again|later|sign in again)/i, 'server.tooMany', () => ({})],
  [/^Insufficient stock for (.+)$/, 'server.notEnoughStock', (m) => ({ name: m[1] })],
  [/^Minimum order of ([\d.,]+) DH required$/, 'server.couponMinimum', (m) => ({ amount: m[1] })],
  [/^This coupon can be used (\d+) times per customer$/, 'server.couponPerCustomer', (m) => ({ n: m[1] })],
  [/Password must be at least (\d+) characters/, 'server.passwordShort', (m) => ({ n: m[1] })],
]

/** The admin stays in English, like the rest of its screens. */
const inAdmin = () => typeof window !== 'undefined' && /^\/(?:(?:fr|ar)\/)?admin(?:-print)?(?:\/|$)/.test(window.location.pathname)

export function localizeServerMessage(message: string, locale: Locale): string {
  if (locale === 'en' || inAdmin()) return message
  const exact = EXACT[message.trim()]
  if (exact) return translate(locale, exact)
  for (const [rx, key, vars] of PATTERNS) {
    const match = message.match(rx)
    if (match) return translate(locale, key, vars(match))
  }
  return message
}
