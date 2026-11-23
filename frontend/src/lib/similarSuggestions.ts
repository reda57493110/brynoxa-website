import type { Product } from '@/types'

/** How many "Similar products" a staff member can choose for one product (server: MAX_SIMILAR) */
export const MAX_SIMILAR = 8

export type SimilarReason =
  | { kind: 'sameBrand'; price: number }
  | { kind: 'cheaper'; diff: number }
  | { kind: 'pricier'; diff: number }
  | { kind: 'samePrice' }
  | { kind: 'bestseller'; count: number }

export type SimilarSuggestion = { product: Product; reason: SimilarReason }

const categoryOf = (p: Product) => (typeof p.category === 'object' && p.category ? p.category._id : String(p.category || ''))
const brandOf = (p: Product) => (typeof p.brand === 'object' && p.brand ? p.brand._id : String(p.brand || ''))

/**
 * Admin → Products → Similar products → Suggestions: alternatives to `main` a customer would
 * compare — same category, in stock, active, never the product itself nor its own versions
 * (sizes / colours). Ranked: closest price (a little cheaper or a little better), same brand,
 * then what sells. Each with the reason shown to staff.
 */
export function suggestSimilar(main: Product, catalog: Product[], limit = MAX_SIMILAR): SimilarSuggestion[] {
  const cat = categoryOf(main)
  const brand = brandOf(main)
  const pool = catalog.filter(
    (p) =>
      p._id !== main._id &&
      p.isActive &&
      p.stock > 0 &&
      categoryOf(p) === cat &&
      !(main.variantGroup && p.variantGroup === main.variantGroup)
  )
  const price = Math.max(1, main.price)
  const score = (p: Product) => {
    const gap = Math.abs(p.price - main.price) / price // 0 = same price
    return (1 - Math.min(gap, 1)) * 10 + (brand && brandOf(p) === brand ? 3 : 0) + Math.log1p(p.soldCount || 0)
  }
  return [...pool]
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
    .map((p) => {
      const diff = Math.round(p.price - main.price)
      const close = Math.abs(diff) <= main.price * 0.05
      const reason: SimilarReason =
        brand && brandOf(p) === brand
          ? { kind: 'sameBrand', price: p.price }
          : close
            ? (p.soldCount || 0) >= 3
              ? { kind: 'bestseller', count: p.soldCount }
              : { kind: 'samePrice' }
            : diff < 0
              ? { kind: 'cheaper', diff: -diff }
              : { kind: 'pricier', diff }
      return { product: p, reason }
    })
}
