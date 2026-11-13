/**
 * Ads & social media: which campaign brought an order (mirrored in frontend/src/lib/adTracking.ts —
 * keep both in sync).
 *
 * Each campaign has a tracking link: the shop address with utm_source (platform), utm_medium
 * (paid / social) and utm_campaign (the campaign's code). The shop remembers these for 30 days and
 * sends them with the order; the order keeps them in `marketing`.
 */

export const AD_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'google', 'snapchat', 'whatsapp', 'youtube', 'other'] as const;
export type AdPlatform = (typeof AD_PLATFORMS)[number];

/** paid = you pay the platform (ad); organic = a free post / story / video */
export const AD_KINDS = ['paid', 'organic'] as const;
export type AdKind = (typeof AD_KINDS)[number];

export const UTM_MEDIUM: Record<AdKind, string> = { paid: 'paid', organic: 'social' };

/** How long a visit through a tracking link still counts for an order */
export const UTM_KEEP_DAYS = 30;

/** A utm value as kept on an order: lower case, letters / digits / . _ -, 64 characters at most. */
export function cleanUtmValue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 64);
  return s || undefined;
}

export type OrderMarketing = { source?: string; medium?: string; campaign?: string };

/** The utm values sent with an order; undefined when none is usable. */
export function cleanUtm(input: unknown): OrderMarketing | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const o = input as Record<string, unknown>;
  const out: OrderMarketing = {};
  const source = cleanUtmValue(o.source);
  const medium = cleanUtmValue(o.medium);
  const campaign = cleanUtmValue(o.campaign);
  if (source) out.source = source;
  if (medium) out.medium = medium;
  if (campaign) out.campaign = campaign;
  return source || campaign ? out : undefined;
}

/** "Black Friday 2026 — PCs" → "black-friday-2026-pcs" (the campaign's code in its link) */
export function campaignCode(name: string): string {
  const s = String(name ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
  return s || 'campaign';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Results of a campaign / platform / everything: cost per order and return per 1 DH spent. */
export function adResults(input: { spent: number; orders: number; revenue: number }) {
  const spent = round2(Math.max(0, input.spent || 0));
  const orders = Math.max(0, Math.round(input.orders || 0));
  const revenue = round2(Math.max(0, input.revenue || 0));
  return {
    spent,
    orders,
    revenue,
    /** null = no order yet (nothing to divide by) */
    costPerOrder: orders > 0 ? round2(spent / orders) : null,
    /** revenue for each 1 DH spent; null = nothing spent (free posts) */
    roas: spent > 0 ? round2(revenue / spent) : null,
  };
}
