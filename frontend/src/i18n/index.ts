import { en, type Messages } from './en'
import { fr } from './fr'
import { ar } from './ar'

export type Locale = 'en' | 'fr' | 'ar'

export const LOCALES: { id: Locale; label: string; native: string; dir: 'ltr' | 'rtl' }[] = [
  { id: 'en', label: 'English', native: 'EN', dir: 'ltr' },
  { id: 'fr', label: 'Français', native: 'FR', dir: 'ltr' },
  { id: 'ar', label: 'العربية', native: 'AR', dir: 'rtl' },
]

export const messages: Record<Locale, Messages> = { en, fr, ar }

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'fr' || value === 'ar'
}

type LeafPath<T, Prefix extends string = ''> = T extends string
  ? Prefix
  : T extends readonly unknown[]
    ? never
    : {
        [K in keyof T & string]: LeafPath<T[K], Prefix extends '' ? K : `${Prefix}.${K}`>
      }[keyof T & string]

export type MessageKey = LeafPath<typeof en>

function lookup(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, tree)
}

export function translate(
  locale: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>
) {
  const raw = lookup(messages[locale], key) ?? lookup(en, key)
  let text = typeof raw === 'string' ? raw : key
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value))
    }
  }
  return text
}

export function getMessages(locale: Locale): Messages {
  return messages[locale]
}

/** Localized category name by slug; falls back to API name. */
export function categoryDisplayName(locale: Locale, slug: string, fallback: string) {
  const key = `catalog.categories.${slug}.name`
  const raw = lookup(messages[locale], key) ?? lookup(en, key)
  return typeof raw === 'string' ? raw : fallback
}

/** Localized category description by slug; falls back to API description. */
export function categoryDisplayDescription(
  locale: Locale,
  slug: string,
  fallback?: string
) {
  const key = `catalog.categories.${slug}.description`
  const raw = lookup(messages[locale], key) ?? lookup(en, key)
  if (typeof raw === 'string') return raw
  return fallback || ''
}

export function orderStatusKey(status: string): MessageKey {
  switch (status) {
    case 'confirmed':
    case 'processing':
      return 'orders.confirmed'
    case 'shipped':
      return 'orders.shipped'
    case 'delivered':
      return 'orders.delivered'
    case 'cancelled':
      return 'orders.cancelledStatus'
    default:
      return 'orders.pending'
  }
}

export { en, fr, ar }
export type { Messages }
