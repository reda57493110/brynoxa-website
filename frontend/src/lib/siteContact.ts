/**
 * Admin → Settings → Contact & business (mirrored in backend/src/utils/siteContact.ts — keep both in
 * sync): the shop's numbers, social pages and legal details.
 */

export const SOCIAL_KEYS = ['facebook', 'instagram', 'tiktok', 'youtube'] as const
export type SocialKey = (typeof SOCIAL_KEYS)[number]

export type SiteContact = {
  whatsapp: string
  phone: string
  facebook: string
  instagram: string
  tiktok: string
  youtube: string
  businessName: string
  address: string
  ice: string
  rc: string
}

export const EMPTY_SITE_CONTACT: SiteContact = {
  whatsapp: '',
  phone: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  businessName: '',
  address: '',
  ice: '',
  rc: '',
}

export const SOCIAL_HOSTS: Record<SocialKey, string[]> = {
  facebook: ['facebook.com', 'fb.com'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
}

export const SOCIAL_NAME: Record<SocialKey, string> = { facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube' }

/** "07 79 31 80 61" / "+212 779-318061" / "00212…" → "212779318061"; '' = not a number */
export function normalizePhone(value: unknown): string {
  let d = String(value ?? '').replace(/[^\d+]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (/^0\d{9}$/.test(d)) d = `212${d.slice(1)}`
  d = d.replace(/\D/g, '')
  return /^[1-9]\d{7,14}$/.test(d) ? d : ''
}

/** "212779318061" → "07 79 31 80 61" (Moroccan numbers the local way), others "+33 …" */
export function formatPhone(international: string): string {
  const m = /^212(\d{9})$/.exec(international)
  if (m) return `0${m[1]}`.replace(/(\d{2})(?=\d)/g, '$1 ').trim()
  return international ? `+${international}` : ''
}

export function normalizeSocialUrl(key: SocialKey, value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '')
    const ok = SOCIAL_HOSTS[key].some((h) => host === h || host.endsWith(`.${h}`))
    if (!ok || url.username || url.password) return ''
    url.protocol = 'https:'
    return url.toString().slice(0, 300)
  } catch {
    return ''
  }
}

/** "@brynoxa1" from an Instagram / TikTok address, the page name otherwise */
export function socialHandle(key: SocialKey, url: string): string {
  try {
    const path = new URL(url).pathname.split('/').filter(Boolean)
    const last = path[0] === 'profile.php' ? '' : (path[path.length - 1] ?? '')
    if (!last) return SOCIAL_NAME[key]
    return key === 'facebook' || key === 'youtube' ? last.replace(/^@/, '') : `@${last.replace(/^@/, '')}`
  } catch {
    return SOCIAL_NAME[key]
  }
}
