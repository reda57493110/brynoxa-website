/**
 * Google title + description for a product page, in the page language: the model, key specs,
 * the price in Morocco and the shop's promises (what people type: "hp elitebook i7 prix maroc").
 * Kept free of imports so tests can load it directly.
 */
export type SeoLocale = 'en' | 'fr' | 'ar'

const COPY: Record<SeoLocale, { price: string; at: (p: string) => string; promise: string }> = {
  en: { price: 'Price in Morocco', at: (p) => `at ${p} in Morocco`, promise: 'Cash on delivery, 6-month warranty and 14-day returns.' },
  fr: { price: 'Prix au Maroc', at: (p) => `à ${p} au Maroc`, promise: 'Paiement à la livraison, garantie 6 mois et retour sous 14 jours.' },
  ar: { price: 'الثمن في المغرب', at: (p) => `بثمن ${p} في المغرب`, promise: 'الدفع عند الاستلام، ضمان 6 أشهر وإرجاع خلال 14 يوماً.' },
}

/** Google shows about 60 characters of a title and 155 of a description. */
const TITLE_MAX = 65
const DESC_MAX = 158

/** "8 990" with a thin no-break space style used in Morocco, plus DH. */
export function priceText(price: number) {
  return `${Math.round(price).toLocaleString('fr-FR').replace(/ | /g, ' ')} DH`
}

function cut(text: string, max: number) {
  if (text.length <= max) return text
  const room = text.slice(0, max - 1)
  return `${room.slice(0, Math.max(room.lastIndexOf(' '), max - 20)).replace(/[\s,.;:—-]+$/, '')}…`
}

export function productSeoText({
  name,
  price,
  specs = [],
  shortDescription = '',
  locale = 'en',
}: {
  /** Name including the variant ("… (16 GB / 512 GB)"). */
  name: string
  price: number
  /** Key specs already formatted ("Intel Core i7", "16 GB"). */
  specs?: string[]
  shortDescription?: string
  locale?: SeoLocale
}) {
  const c = COPY[locale] ?? COPY.en
  const lower = name.toLowerCase()
  // Specs the name does not already say, so the title adds information
  const extra = specs.filter((s) => s && !lower.includes(s.toLowerCase())).slice(0, 2)

  let title = `${name}${extra.length ? ' ' + extra.join(' ') : ''} — ${c.price} | Brynoxa`
  if (title.length > TITLE_MAX) title = `${name} — ${c.price} | Brynoxa`
  if (title.length > TITLE_MAX) title = `${cut(name, TITLE_MAX - 10)} | Brynoxa`

  const parts = [
    `${name} ${c.at(priceText(price))}.`,
    specs.length ? `${specs.slice(0, 4).join(', ')}.` : '',
    c.promise,
  ].filter(Boolean)
  let description = parts.join(' ')
  const own = shortDescription.trim()
  if (own && description.length + own.length + 1 <= DESC_MAX) description = `${description} ${own}`
  return { title, description: cut(description, DESC_MAX) }
}
