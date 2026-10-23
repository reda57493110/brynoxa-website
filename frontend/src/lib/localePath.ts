/**
 * Language in the address: English pages have no prefix (/shop), French and Arabic pages live under
 * /fr and /ar (/fr/shop, /ar/product/x), so Google can list each language separately.
 *
 * The router uses the prefix as its basename, so every link inside the app keeps the language on
 * its own. Kept free of imports: themeInit.ts uses it before anything else loads.
 */
export type PathLocale = 'en' | 'fr' | 'ar'

export const PREFIXED_LOCALES = ['fr', 'ar'] as const
export const ALL_PATH_LOCALES: PathLocale[] = ['en', 'fr', 'ar']

/** "fr" / "ar" when the path starts with that prefix, else null (English). */
export function localeFromPath(pathname: string): 'fr' | 'ar' | null {
  const first = pathname.split('/')[1]
  return first === 'fr' || first === 'ar' ? first : null
}

/** The path without its language prefix: "/fr/shop" → "/shop", "/ar" → "/". */
export function stripLocale(pathname: string): string {
  const lang = localeFromPath(pathname)
  if (!lang) return pathname || '/'
  const rest = pathname.slice(lang.length + 1)
  return rest.startsWith('/') ? rest : `/${rest}`
}

/** The same page in another language: ("/shop", "fr") → "/fr/shop"; ("/", "en") → "/". */
export function localizedPath(path: string, locale: PathLocale): string {
  const clean = stripLocale(path.startsWith('/') ? path : `/${path}`)
  if (locale === 'en') return clean
  return clean === '/' ? `/${locale}` : `/${locale}${clean}`
}

/** Router basename for this visit ("" for English). Read once: changing language reloads the page. */
export function routerBasename(): string {
  if (typeof window === 'undefined') return ''
  const lang = localeFromPath(window.location.pathname)
  return lang ? `/${lang}` : ''
}

/** Language of the current address. */
export function currentPathLocale(): PathLocale {
  if (typeof window === 'undefined') return 'en'
  return localeFromPath(window.location.pathname) ?? 'en'
}
