/**
 * Ads & social media (mirrored in backend/src/utils/adTracking.ts — keep both in sync).
 *
 * A campaign's tracking link carries utm_source / utm_medium / utm_campaign. The shop remembers
 * them for 30 days (the latest link wins) and sends them with the order, so Admin → Ads can count
 * the orders and revenue of each ad or post.
 */

export const AD_PLATFORMS = ['facebook', 'instagram', 'tiktok', 'google', 'snapchat', 'whatsapp', 'youtube', 'other'] as const
export type AdPlatform = (typeof AD_PLATFORMS)[number]

export const AD_KINDS = ['paid', 'organic'] as const
export type AdKind = (typeof AD_KINDS)[number]

export const AD_PLATFORM_LABEL: Record<AdPlatform, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  google: 'Google',
  snapchat: 'Snapchat',
  whatsapp: 'WhatsApp',
  youtube: 'YouTube',
  other: 'Other',
}

export const AD_KIND_LABEL: Record<AdKind, string> = { paid: 'Paid ad', organic: 'Free post' }

export const UTM_MEDIUM: Record<AdKind, string> = { paid: 'paid', organic: 'social' }

/** How long a visit through a tracking link still counts for an order */
export const UTM_KEEP_DAYS = 30
const STORE_KEY = 'brx-utm'

export type Utm = { source?: string; medium?: string; campaign?: string }

/** Same cleaning as the server: lower case, letters / digits / . _ -, 64 characters at most */
export function cleanUtmValue(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const s = v
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 64)
  return s || undefined
}

/** utm values of an address (?utm_source=…); null when the address has none */
export function utmFromSearch(search: string): Utm | null {
  const q = new URLSearchParams(search)
  const out: Utm = {}
  const source = cleanUtmValue(q.get('utm_source'))
  const medium = cleanUtmValue(q.get('utm_medium'))
  const campaign = cleanUtmValue(q.get('utm_campaign'))
  if (source) out.source = source
  if (medium) out.medium = medium
  if (campaign) out.campaign = campaign
  return source || campaign ? out : null
}

/** Called on every shop page: remembers the tracking link the customer came through */
export function captureUtm(search: string, now = Date.now()) {
  const utm = utmFromSearch(search)
  if (!utm) return
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...utm, at: now }))
  } catch {
    /* private mode: the order just is not credited */
  }
}

/** The remembered link, if less than 30 days old (sent with the order) */
export function readUtm(now = Date.now()): Utm | undefined {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return undefined
    const v = JSON.parse(raw) as Utm & { at?: number }
    if (typeof v.at !== 'number' || now - v.at > UTM_KEEP_DAYS * 86_400_000) {
      localStorage.removeItem(STORE_KEY)
      return undefined
    }
    const out: Utm = {}
    for (const k of ['source', 'medium', 'campaign'] as const) {
      const c = cleanUtmValue(v[k])
      if (c) out[k] = c
    }
    return out.source || out.campaign ? out : undefined
  } catch {
    return undefined
  }
}

/** The full link to put in an ad or post */
export function trackingLink(origin: string, landingPath: string, trackingQuery: string) {
  const path = landingPath && landingPath.startsWith('/') ? landingPath : '/'
  return `${origin.replace(/\/$/, '')}${path}${path.includes('?') ? '&' : '?'}${trackingQuery}`
}

/** "12.5 DH" per order; "—" when nothing to divide */
export function roasLabel(roas: number | null) {
  return roas === null ? '—' : `${roas.toFixed(roas >= 10 ? 0 : 1)} DH`
}
