/**
 * Where an order came from. Mirrors backend/src/utils/orderOrigin.ts — keep both in sync.
 * "website" = checkout; the others are entered by staff in Admin → Orders → New order.
 */
export const ORDER_ORIGINS = ['website', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'phone', 'store', 'other'] as const
export type OrderOrigin = (typeof ORDER_ORIGINS)[number]

export const MANUAL_ORDER_ORIGINS = ORDER_ORIGINS.filter((o) => o !== 'website') as Exclude<OrderOrigin, 'website'>[]

export const ORDER_ORIGIN_LABEL: Record<OrderOrigin, string> = {
  website: 'Website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  phone: 'Phone call',
  store: 'In the shop',
  other: 'Other',
}

/** Orders from before the field existed came from the website. */
export function originOf(o: { origin?: string | null }): OrderOrigin {
  return (ORDER_ORIGINS as readonly string[]).includes(o.origin || '') ? (o.origin as OrderOrigin) : 'website'
}

/** Customers entered without an email get a hidden stand-in address; never show it. */
export function shownEmail(email?: string | null): string {
  return email && !/\.invalid$/i.test(email) ? email : ''
}
