/**
 * The shop's identity: name (Settings.storeName), logo and slogan (Settings.branding), set in
 * Admin → Settings → General → Store identity. Mirrored in backend/src/utils/branding.ts.
 *
 * Applied with the other site settings (lib/site.ts applySiteSettings, from the layouts), so every
 * page drawn after that shows them. Texts written with the built-in name ("Brynoxa") are switched
 * by withBrand — translate() does it for all interface texts. Read BRAND when rendering, never copy
 * it at load time. No imports: loaded by i18n and by tests.
 */

export const DEFAULT_STORE_NAME = 'Brynoxa'
/** Built-in logo mark (128 px copy, shown at 32–40 px) */
export const DEFAULT_LOGO = '/brand/brynoxa-mark-128.webp'

export type BrandLocale = 'en' | 'fr' | 'ar'
export type BrandingSettings = {
  storeName?: string | null
  branding?: { logo?: string | null; tagline?: Partial<Record<BrandLocale, string>> | null } | null
}

type Brand = { name: string; logo: string; customLogo: boolean; tagline: Record<BrandLocale, string> }

const LOGO_RX = /^(https:\/\/res\.cloudinary\.com\/[^\s"'<>]+|\/api\/v1\/images\/[a-f0-9]{24})$/i

export function brandFrom(settings?: BrandingSettings | null): Brand {
  const name = String(settings?.storeName ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || DEFAULT_STORE_NAME
  const raw = String(settings?.branding?.logo ?? '').trim()
  const logo = LOGO_RX.test(raw) ? raw : ''
  const t = settings?.branding?.tagline ?? {}
  return {
    name,
    logo: logo || DEFAULT_LOGO,
    customLogo: Boolean(logo),
    tagline: { en: String(t.en ?? '').trim(), fr: String(t.fr ?? '').trim(), ar: String(t.ar ?? '').trim() },
  }
}

export let BRAND: Brand = brandFrom(null)

/** Uses the saved identity from now on (and shows the logo in the browser tab) */
export function applyBrand(settings?: BrandingSettings | null) {
  BRAND = brandFrom(settings)
  if (typeof document === 'undefined') return
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
  if (icon && BRAND.customLogo && icon.href !== BRAND.logo) {
    icon.href = BRAND.logo
    icon.removeAttribute('type')
  }
}

export const brandName = () => BRAND.name

/** A text written with the built-in name, shown with the shop's current name */
export function withBrand(text: string): string {
  return BRAND.name === DEFAULT_STORE_NAME || !text.includes(DEFAULT_STORE_NAME) ? text : text.split(DEFAULT_STORE_NAME).join(BRAND.name)
}

/** The saved slogan in this language, or '' (the built-in one is used then) */
export const brandTagline = (locale: BrandLocale) => BRAND.tagline[locale] || ''
