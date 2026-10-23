/**
 * Where an order came from. "website" = placed by the customer at checkout; the others are
 * entered by staff in Admin → Orders → New order (sales on social media, by phone, in the shop).
 * Mirrored in frontend/src/lib/orderOrigin.ts — keep both in sync.
 */
export const ORDER_ORIGINS = ['website', 'facebook', 'instagram', 'whatsapp', 'tiktok', 'phone', 'store', 'other'] as const;
export type OrderOrigin = (typeof ORDER_ORIGINS)[number];

/** Sources staff can pick for an order they enter themselves. */
export const MANUAL_ORDER_ORIGINS = ORDER_ORIGINS.filter((o) => o !== 'website') as Exclude<OrderOrigin, 'website'>[];

export const ORDER_ORIGIN_LABEL: Record<OrderOrigin, string> = {
  website: 'Website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  tiktok: 'TikTok',
  phone: 'Phone call',
  store: 'In the shop',
  other: 'Other',
};

/** "Guest TikTok", "Guest Shop"…: the label of a customer added by staff from that source. */
export function guestLabel(origin: OrderOrigin): string {
  const short: Partial<Record<OrderOrigin, string>> = { phone: 'Phone', store: 'Shop' };
  return `Guest ${short[origin] ?? ORDER_ORIGIN_LABEL[origin]}`;
}

/** Customers list filter by where they came from (no source = website). */
export function customerSourceFilter(value?: string): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (value === 'other_channels') return { source: { $nin: ['website', null] } };
  if (value === 'website') return { source: { $in: ['website', null] } };
  if ((ORDER_ORIGINS as readonly string[]).includes(value)) return { source: value };
  return undefined;
}

/** Orders list filter: one source, or "other" = every source except the website. */
export function originFilter(value?: string): Record<string, unknown> | undefined {
  if (!value) return undefined;
  if (value === 'other_channels') return { origin: { $nin: ['website', null] } };
  // Orders from before this field existed are website orders
  if (value === 'website') return { origin: { $in: ['website', null] } };
  if ((ORDER_ORIGINS as readonly string[]).includes(value)) return { origin: value };
  return undefined;
}
