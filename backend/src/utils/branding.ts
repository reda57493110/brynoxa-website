/**
 * Admin → Settings → General → Store identity: the shop's name (Settings.storeName), logo and
 * slogan (Settings.branding). Shown everywhere: header, footer, menus, page titles, legal pages,
 * delivery slips, emails. Mirrored in frontend/src/lib/brand.ts — keep both in sync.
 */

export const DEFAULT_STORE_NAME = 'Brynoxa';
/** Built-in logo mark (shown when no logo is uploaded) */
export const DEFAULT_LOGO_PATH = '/brand/brynoxa-mark.png';

export type BrandingTaglines = { en: string; fr: string; ar: string };
export type Branding = { logo: string; tagline: BrandingTaglines };

export const EMPTY_BRANDING: Branding = { logo: '', tagline: { en: '', fr: '', ar: '' } };

/** A logo uploaded through the admin (Cloudinary or the shop's own image store) — never another site */
const LOGO_RX = /^(https:\/\/res\.cloudinary\.com\/[^\s"'<>]+|\/api\/v1\/images\/[a-f0-9]{24})$/i;

export function cleanLogo(value: unknown): string {
  const v = String(value ?? '').trim();
  return v && LOGO_RX.test(v) && v.length <= 500 ? v : '';
}

const line = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);

/** Why the branding cannot be saved, or null */
export function brandingIssue(input: { logo?: unknown } | undefined): string | null {
  if (input?.logo !== undefined && String(input.logo).trim() && !cleanLogo(input.logo)) {
    return 'Logo: upload the picture here (pictures from other sites are not accepted)';
  }
  return null;
}

/** What is saved: fields not sent keep their saved value */
export function sanitizeBranding(input: unknown, current?: Partial<Branding> | null): Branding {
  const base: Branding = {
    logo: current?.logo ?? '',
    tagline: { ...EMPTY_BRANDING.tagline, ...(current?.tagline ?? {}) },
  };
  if (!input || typeof input !== 'object') return base;
  const o = input as { logo?: unknown; tagline?: Record<string, unknown> };
  const out: Branding = { logo: base.logo, tagline: { ...base.tagline } };
  if (o.logo !== undefined) out.logo = cleanLogo(o.logo);
  if (o.tagline && typeof o.tagline === 'object') {
    for (const l of ['en', 'fr', 'ar'] as const) if (o.tagline[l] !== undefined) out.tagline[l] = line(o.tagline[l]);
  }
  return out;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * An email with the shop's current name and logo (the templates are written with the built-in
 * ones). `siteUrl` makes the logo address complete for mail apps.
 */
export function brandEmail(
  email: { subject: string; html: string; text?: string },
  brand: { storeName?: string | null; logo?: string | null },
  siteUrl: (path: string) => string
) {
  const name = String(brand.storeName ?? '').trim() || DEFAULT_STORE_NAME;
  const logo = cleanLogo(brand.logo);
  let { subject, html, text } = email;
  if (logo) {
    const src = logo.startsWith('/') ? siteUrl(logo) : logo;
    html = html.split(siteUrl(DEFAULT_LOGO_PATH)).join(src);
  }
  if (name !== DEFAULT_STORE_NAME) {
    // The header wordmark ("Bryno" + coloured "xa") becomes the name
    html = html.replace(/Bryno<span style="color:[^"]*;">xa<\/span>/g, escapeHtml(name));
    html = html.split(DEFAULT_STORE_NAME).join(escapeHtml(name));
    subject = subject.split(DEFAULT_STORE_NAME).join(name);
    text = text?.split(DEFAULT_STORE_NAME).join(name);
  }
  return { subject, html, text };
}
