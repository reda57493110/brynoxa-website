/**
 * Admin → Settings → Contact & business: the shop's WhatsApp / phone numbers, social pages and
 * legal details, shown all over the shop (footer, Contact, Help, Terms, delivery slips…).
 * Mirrored in frontend/src/lib/siteContact.ts — keep both in sync.
 *
 * Empty WhatsApp / phone = the built-in number; empty social page or legal detail = not shown.
 * The email customers see is Settings → General → Support email.
 */

export const SOCIAL_KEYS = ['facebook', 'instagram', 'tiktok', 'youtube'] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

export type SiteContact = {
  whatsapp: string;
  phone: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  businessName: string;
  address: string;
  ice: string;
  rc: string;
};

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
};

/** Hosts each social page may be on */
export const SOCIAL_HOSTS: Record<SocialKey, string[]> = {
  facebook: ['facebook.com', 'fb.com'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  youtube: ['youtube.com', 'youtu.be'],
};

/**
 * A phone number as international digits: "07 79 31 80 61" / "+212 779-318061" / "00212…" →
 * "212779318061". Moroccan numbers may be typed the local way (0 + 9 digits). '' = not a number.
 */
export function normalizePhone(value: unknown): string {
  let d = String(value ?? '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (/^0\d{9}$/.test(d)) d = `212${d.slice(1)}`;
  d = d.replace(/\D/g, '');
  return /^[1-9]\d{7,14}$/.test(d) ? d : '';
}

/** A social page address on its own site ("instagram.com/brynoxa1" is accepted) → https URL; '' = not valid */
export function normalizeSocialUrl(key: SocialKey, value: unknown): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
    const ok = SOCIAL_HOSTS[key].some((h) => host === h || host.endsWith(`.${h}`));
    if (!ok || url.username || url.password) return '';
    url.protocol = 'https:';
    return url.toString().slice(0, 300);
  } catch {
    return '';
  }
}

const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Why a value cannot be saved (shown to the person saving), or null when it can */
export function siteContactIssue(input: Partial<Record<keyof SiteContact, unknown>>): string | null {
  for (const k of ['whatsapp', 'phone'] as const) {
    if (input[k] !== undefined && String(input[k]).trim() && !normalizePhone(input[k])) {
      return `${k === 'whatsapp' ? 'WhatsApp' : 'Phone'}: enter a full number, e.g. 06 12 34 56 78 or +212 6 12 34 56 78`;
    }
  }
  for (const k of SOCIAL_KEYS) {
    if (input[k] !== undefined && String(input[k]).trim() && !normalizeSocialUrl(k, input[k])) {
      return `${k[0].toUpperCase()}${k.slice(1)}: paste the address of your page on ${SOCIAL_HOSTS[k][0]}`;
    }
  }
  if (input.ice !== undefined && String(input.ice).trim() && !/^\d{9,20}$/.test(String(input.ice).replace(/\s/g, ''))) {
    return 'ICE: digits only (15 digits)';
  }
  return null;
}

/** What is saved: fields not sent keep their saved value */
export function sanitizeSiteContact(input: unknown, current?: Partial<SiteContact> | null): SiteContact {
  const base: SiteContact = { ...EMPTY_SITE_CONTACT, ...(current ?? {}) };
  if (!input || typeof input !== 'object') return base;
  const o = input as Record<string, unknown>;
  const out: SiteContact = { ...base };
  if (o.whatsapp !== undefined) out.whatsapp = normalizePhone(o.whatsapp);
  if (o.phone !== undefined) out.phone = normalizePhone(o.phone);
  for (const k of SOCIAL_KEYS) if (o[k] !== undefined) out[k] = normalizeSocialUrl(k, o[k]);
  if (o.businessName !== undefined) out.businessName = text(o.businessName, 120);
  if (o.address !== undefined) out.address = text(o.address, 300);
  if (o.ice !== undefined) out.ice = String(o.ice ?? '').replace(/\D/g, '').slice(0, 20);
  if (o.rc !== undefined) out.rc = text(o.rc, 60);
  return out;
}
