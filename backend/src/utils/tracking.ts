/**
 * Admin → Settings → Tracking codes: the ad platforms' codes the shop loads, so Facebook /
 * Instagram (Meta Pixel), TikTok (TikTok Pixel) and Google Analytics see visits, carts and orders.
 * Mirrored in frontend/src/lib/analytics.ts (same checks) — keep both in sync.
 * Only ids are stored (never a script): the shop builds the official loader itself.
 */

export type TrackingIds = { metaPixelId: string; tiktokPixelId: string; gaMeasurementId: string };

export const EMPTY_TRACKING: TrackingIds = { metaPixelId: '', tiktokPixelId: '', gaMeasurementId: '' };

/** Meta Pixel id: 10–20 digits, e.g. 1234567890123456 */
export const META_PIXEL_RX = /^\d{10,20}$/;
/** TikTok Pixel id: 15–30 capital letters / digits, e.g. CABCD1234EFGH5678 */
export const TIKTOK_PIXEL_RX = /^[A-Z0-9]{15,30}$/;
/** Google Analytics 4: G- and letters / digits, e.g. G-AB12CD34EF */
export const GA_ID_RX = /^G-[A-Z0-9]{4,16}$/;

const tidy = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, '');

export function cleanTracking(key: keyof TrackingIds, value: unknown): string {
  const v = tidy(value);
  if (!v) return '';
  if (key === 'metaPixelId') return META_PIXEL_RX.test(v) ? v : '';
  const up = v.toUpperCase();
  if (key === 'tiktokPixelId') return TIKTOK_PIXEL_RX.test(up) ? up : '';
  return GA_ID_RX.test(up) ? up : '';
}

const LABEL: Record<keyof TrackingIds, string> = {
  metaPixelId: 'Meta Pixel ID: digits only (Events Manager → your pixel → ID)',
  tiktokPixelId: 'TikTok Pixel ID: letters and digits (TikTok Ads Manager → Events → your pixel)',
  gaMeasurementId: 'Google Analytics: the Measurement ID starting with G-',
};

/** Why a value cannot be saved, or null */
export function trackingIssue(input: Partial<Record<keyof TrackingIds, unknown>>): string | null {
  for (const key of Object.keys(LABEL) as (keyof TrackingIds)[]) {
    if (input[key] !== undefined && tidy(input[key]) && !cleanTracking(key, input[key])) return LABEL[key];
  }
  return null;
}

/** What is saved: fields not sent keep their saved value */
export function sanitizeTracking(input: unknown, current?: Partial<TrackingIds> | null): TrackingIds {
  const out: TrackingIds = { ...EMPTY_TRACKING, ...(current ?? {}) };
  if (!input || typeof input !== 'object') return out;
  const o = input as Record<string, unknown>;
  for (const key of Object.keys(EMPTY_TRACKING) as (keyof TrackingIds)[]) {
    if (o[key] !== undefined) out[key] = cleanTracking(key, o[key]);
  }
  return out;
}
