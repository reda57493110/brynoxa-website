import { inBudget } from './homeRows'
import type { Product } from '@/types'

/**
 * Admin → Products → home page board → "Suggestions": for each home section, the products of the
 * catalog that fit it best, each with the reason. Staff review them, untick what they don't want
 * and approve (it becomes "My choice"). Nothing here changes the shop by itself.
 *
 * Only active products in stock. Rules per section:
 * - banner: the best deals first (biggest saving, then what sells), at most 2 per category, filled
 *   with best sellers / high-end products when there are fewer than 8 deals;
 * - deals: every product with an old price, biggest discount first;
 * - featured (top picks first): what sells, what is new, good deals, featured ones — 3 per category;
 * - carousel (top picks after): the next ones by the same score, not already in the first list;
 * - new: the newest products added;
 * - signature: Brynoxa products, best sellers first;
 * - budget bands: the best value in the price band (discount and sales), 3 per category.
 */

export type SuggestReason =
  | { kind: 'deal'; pct: number; saved: number }
  | { kind: 'sold'; count: number }
  | { kind: 'new'; days: number }
  | { kind: 'featured' }
  | { kind: 'flagship'; price: number }
  | { kind: 'brynoxa'; sold: number }
  | { kind: 'value'; price: number }

export type Suggestion = { product: Product; reason: SuggestReason }

const DAY = 86_400_000
/** From this price a product reads as high-end (a PC, a laptop); below, as good value */
const HIGH_END = 8000

/** No deal, no sale, not new: high-end or good value, by its price */
const byPrice = (p: Product): SuggestReason => (p.price >= HIGH_END ? { kind: 'flagship', price: p.price } : { kind: 'value', price: p.price })

const discount = (p: Product) => (p.compareAtPrice && p.compareAtPrice > p.price ? 1 - p.price / p.compareAtPrice : 0)
const saved = (p: Product) => (p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice - p.price : 0)
const sold = (p: Product) => Math.max(0, p.soldCount || 0)
const ageDays = (p: Product, now: number) => (p.createdAt ? Math.max(0, Math.floor((now - new Date(p.createdAt).getTime()) / DAY)) : 9999)
const categoryOf = (p: Product) => (typeof p.category === 'object' && p.category ? p.category._id : String(p.category || ''))
const brandSlug = (p: Product) => (typeof p.brand === 'object' && p.brand ? p.brand.slug : '')

/** Sorted best first: keep at most `perCategory` of each category, then fill up with the rest */
function diverse(sorted: Product[], limit: number, perCategory: number) {
  const out: Product[] = []
  const count = new Map<string, number>()
  const skipped: Product[] = []
  for (const p of sorted) {
    if (out.length >= limit) break
    const c = categoryOf(p)
    if ((count.get(c) ?? 0) >= perCategory) {
      skipped.push(p)
      continue
    }
    count.set(c, (count.get(c) ?? 0) + 1)
    out.push(p)
  }
  for (const p of skipped) {
    if (out.length >= limit) break
    out.push(p)
  }
  return out
}

/** Why a product fits, in order of what matters most to a customer */
function reasonFor(p: Product, now: number): SuggestReason {
  if (discount(p) > 0) return { kind: 'deal', pct: Math.round(discount(p) * 100), saved: saved(p) }
  if (sold(p) > 0) return { kind: 'sold', count: sold(p) }
  if (ageDays(p, now) <= 30) return { kind: 'new', days: ageDays(p, now) }
  if (p.isFeatured) return { kind: 'featured' }
  return byPrice(p)
}

/** Top picks score: sales, newness, a good deal, chosen as featured before */
function pickScore(p: Product, now: number) {
  const age = ageDays(p, now)
  return Math.log1p(sold(p)) * 6 + (age <= 30 ? 4 : age <= 90 ? 2 : 0) + discount(p) * 20 + (p.isFeatured ? 3 : 0) + Math.min(p.price / 10_000, 3)
}

export type SuggestLimits = { banner: number; featured: number; row: number }

export function suggestHome(
  catalog: Product[],
  budgets: { key: string; min?: number; max?: number }[],
  limits: SuggestLimits,
  now = Date.now()
) {
  const live = catalog.filter((p) => p.isActive && p.stock > 0)
  const wrap = (list: Product[], reason?: (p: Product) => SuggestReason): Suggestion[] => list.map((product) => ({ product, reason: reason ? reason(product) : reasonFor(product, now) }))

  // Deals banner: best deals first, then best sellers / high-end to fill it
  const deals = live.filter((p) => discount(p) > 0)
  const dealScore = (p: Product) => discount(p) * 100 + saved(p) / 200 + Math.log1p(sold(p)) * 3
  const bannerDeals = diverse([...deals].sort((a, b) => dealScore(b) - dealScore(a)), limits.banner, 2)
  const fill = live.filter((p) => !bannerDeals.includes(p)).sort((a, b) => sold(b) - sold(a) || b.price - a.price)
  const banner = diverse([...bannerDeals, ...fill], limits.banner, 2)
  const bannerReason = (p: Product): SuggestReason =>
    discount(p) > 0 ? reasonFor(p, now) : sold(p) > 0 ? { kind: 'sold', count: sold(p) } : byPrice(p)

  // Top picks: first list, then the next ones
  const ranked = [...live].sort((a, b) => pickScore(b, now) - pickScore(a, now))
  const featured = diverse(ranked, limits.featured, 3)
  const carousel = diverse(ranked.filter((p) => !featured.includes(p)), limits.row, 5)

  // New arrivals: the newest first
  const fresh = live.filter((p) => p.createdAt).sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())

  // Brynoxa Signature: own brand, best sellers first, then the newest
  const own = live
    .filter((p) => brandSlug(p) === 'brynoxa')
    .sort((a, b) => sold(b) - sold(a) || new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

  // Budget bands: best value in the band
  const valueScore = (p: Product) => discount(p) * 50 + Math.log1p(sold(p)) * 5 + (ageDays(p, now) <= 60 ? 2 : 0)
  const budget = Object.fromEntries(
    budgets.map((b) => [
      b.key,
      wrap(
        diverse(live.filter((p) => inBudget(p.price, b)).sort((a, c) => valueScore(c) - valueScore(a)), Math.min(limits.row, 12), 3),
        (p) => (discount(p) > 0 ? reasonFor(p, now) : sold(p) > 0 ? { kind: 'sold', count: sold(p) } : { kind: 'value', price: p.price })
      ),
    ])
  ) as Record<string, Suggestion[]>

  return {
    banner: wrap(banner, bannerReason),
    deals: wrap([...deals].sort((a, b) => discount(b) - discount(a) || saved(b) - saved(a)).slice(0, limits.row)),
    featured: wrap(featured),
    carousel: wrap(carousel),
    new: wrap(fresh.slice(0, limits.row), (p) => ({ kind: 'new', days: ageDays(p, now) })),
    signature: wrap(own.slice(0, limits.row), (p) => ({ kind: 'brynoxa', sold: sold(p) })),
    budget,
  }
}
