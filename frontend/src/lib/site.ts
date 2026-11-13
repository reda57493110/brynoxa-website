import {
  EMPTY_SITE_CONTACT,
  SOCIAL_KEYS,
  SOCIAL_NAME,
  formatPhone,
  normalizePhone,
  normalizeSocialUrl,
  socialHandle,
  type SiteContact,
  type SocialKey,
} from './siteContact'

/**
 * The shop's contact details, social pages and legal details. Built-in values below; the owner
 * changes them in Admin → Settings → Contact & business (siteContact) and Settings → General
 * (support email). The shop applies the saved ones as soon as settings arrive (applySiteSettings,
 * from useSiteContactSync in the layouts) and remembers them on the device for the next visit.
 *
 * CONTACT, LEGAL and SOCIAL_LINKS are live bindings: read them when rendering, never copy them
 * into a constant at load time.
 */
const BUILT_IN = {
  whatsapp: '212779318061',
  phone: '212779318061',
  email: 'brynoxa.shop@gmail.com',
  facebook: 'https://www.facebook.com/profile.php?id=61594042771780',
  instagram: 'https://www.instagram.com/brynoxa1',
  businessName: 'Brynoxa',
}

/** Pages shown until Contact & business is saved for the first time (the form starts with them) */
export const BUILT_IN_SOCIAL = { facebook: BUILT_IN.facebook, instagram: BUILT_IN.instagram }

export type SiteSettingsLike = { siteContact?: Partial<SiteContact> | null; supportEmail?: string | null }

type ContactInfo = {
  whatsapp: { label: string; value: string; href: string; number: string }
  phone: { label: string; value: string; href: string }
  email: { label: string; value: string; href: string }
  address: { label: string; value: string; href: string }
  hours: { label: string; value: string }
}

type LegalInfo = { businessName: string; address: string; ice: string; rc: string; updated: string }

export type SocialLink = { id: 'whatsapp' | SocialKey; name: string; href: string; handle: string }

function buildContact(c: SiteContact, supportEmail: string): ContactInfo {
  const wa = normalizePhone(c.whatsapp) || BUILT_IN.whatsapp
  const phone = normalizePhone(c.phone) || normalizePhone(c.whatsapp) || BUILT_IN.phone
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail) ? supportEmail : BUILT_IN.email
  return {
    whatsapp: { label: 'WhatsApp', value: formatPhone(wa), href: `https://wa.me/${wa}`, number: wa },
    phone: { label: 'Phone', value: formatPhone(phone), href: `tel:+${phone}` },
    email: { label: 'Email', value: email, href: `mailto:${email}` },
    address: { label: 'Address', value: c.address || 'Morocco — cash on delivery nationwide', href: `https://wa.me/${wa}` },
    hours: { label: 'Working hours', value: 'Mon–Fri 9:00–18:00 · Sat 10:00–16:00 · Sun closed' },
  }
}

function buildSocial(c: SiteContact, contact: ContactInfo): SocialLink[] {
  const links: SocialLink[] = [{ id: 'whatsapp', name: 'WhatsApp', href: contact.whatsapp.href, handle: contact.whatsapp.value }]
  for (const key of SOCIAL_KEYS) {
    const href = normalizeSocialUrl(key, c[key])
    if (href) links.push({ id: key, name: SOCIAL_NAME[key], href, handle: socialHandle(key, href) })
  }
  return links
}

/** Saved settings → what the shop shows. Contact & business never saved = the built-in pages. */
export function siteInfoFrom(settings?: SiteSettingsLike | null) {
  const saved = { ...EMPTY_SITE_CONTACT, ...(settings?.siteContact ?? {}) }
  const everSaved = Object.values(saved).some(Boolean)
  const c: SiteContact = everSaved ? saved : { ...saved, ...BUILT_IN_SOCIAL }
  const contact = buildContact(c, String(settings?.supportEmail ?? '').trim())
  const legal: LegalInfo = {
    businessName: c.businessName || BUILT_IN.businessName,
    /** Registered business address. */
    address: c.address,
    /** Identifiant Commun de l’Entreprise. */
    ice: c.ice,
    /** Registre du Commerce number and city, e.g. "RC 12345 Casablanca". */
    rc: c.rc,
    /** Date the legal pages were last changed (YYYY-MM-DD). */
    updated: '2026-10-03',
  }
  return { contact, legal, social: buildSocial(c, contact) }
}

const CACHE_KEY = 'brx-site-contact'

function cached(): SiteSettingsLike | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as SiteSettingsLike) : null
  } catch {
    return null
  }
}

const first = siteInfoFrom(cached())
export let CONTACT: ContactInfo = first.contact
/**
 * Business identity shown on the Terms of Sale and Privacy Policy pages.
 * Empty fields are hidden — filled in Admin → Settings → Contact & business.
 */
export let LEGAL: LegalInfo = first.legal
export let SOCIAL_LINKS: SocialLink[] = first.social

let appliedKey = ''

/** Uses the saved contact details from now on (returns true when something changed). */
export function applySiteSettings(settings?: SiteSettingsLike | null): boolean {
  if (!settings) return false
  const picked: SiteSettingsLike = { siteContact: settings.siteContact ?? null, supportEmail: settings.supportEmail ?? '' }
  const key = JSON.stringify(picked)
  if (key === appliedKey) return false
  appliedKey = key
  const next = siteInfoFrom(picked)
  CONTACT = next.contact
  LEGAL = next.legal
  SOCIAL_LINKS = next.social
  try {
    localStorage.setItem(CACHE_KEY, key)
  } catch {
    /* private mode: built-in values until settings arrive */
  }
  return true
}

/**
 * Customer services, in display order. Copy lives in i18n `services.items`;
 * `terms` is the matching Terms of Sale section shown on the service page.
 * Photos are free Unsplash / Pexels photos (their free licenses), linked from their image servers.
 */
const unsplash = (id: string) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1600&h=1000&q=80`
const pexels = (id: number) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1600&h=1000&fit=crop`

export const CUSTOMER_SERVICES = [
  // a new laptop handed over with its signed papers (covered from the day it arrives)
  { id: 'warranty', slug: 'warranty', photo: pexels(7190857), terms: 'warranty' },
  // customer handing a parcel back to a courier
  { id: 'returns', slug: 'returns', photo: pexels(7843933), terms: 'returns' },
  // customer paying the courier in cash at the door
  { id: 'cod', slug: 'cash-on-delivery', photo: pexels(6818151), terms: 'payment' },
  // courier loading plain parcels into the van
  { id: 'delivery', slug: 'home-delivery', photo: pexels(6169052), terms: 'delivery' },
  // support team on headsets
  { id: 'support', slug: 'live-support', photo: unsplash('1626863905121-3b0c0ed7b94c'), terms: null },
  // technician fitting a graphics card
  { id: 'repair', slug: 'repair', photo: unsplash('1604754742629-3e5728249d73'), terms: null },
] as const

export type CustomerService = (typeof CUSTOMER_SERVICES)[number]
