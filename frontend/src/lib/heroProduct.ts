import type { Category, HeroPage, Product } from '@/types'
import { canonicalCategorySlug } from './categorySlug'
import { mainOf } from './categoryTree'

/** Page-header setting meaning "no product — show the page photo". */
export const HERO_NONE = 'none'

/** categoryHeroes key for the shop with no category chosen ("All") */
export const SHOP_ALL = 'all'

/** empty-category: nothing in stock in the category, its photo is shown */
export type HeroSource = 'category' | 'main' | 'from-category' | 'page' | 'auto' | 'none' | 'empty-category'

/** The shop category being browsed: its address and its main category's (for sub-categories). */
export type HeroCategory = { slug: string; main?: string }

/**
 * The header product for a category: in stock, a featured one first, then one with a photo,
 * then any (best sellers first, as the list comes).
 */
export function pickCategoryHero(products: Product[]): Product | null {
  const inStock = products.filter((p) => p.stock > 0)
  return inStock.find((p) => p.isFeatured) ?? inStock.find((p) => p.images?.length) ?? inStock[0] ?? null
}

/**
 * Which header setting applies: on the shop with a category, the one chosen for that category
 * (Admin → Products → Shop page), else for its main category; otherwise the page's own.
 * Returns '' (automatic), a product id, or HERO_NONE.
 */
export function heroSettingFor(
  settings: { pageHeroProducts?: Partial<Record<HeroPage, string>>; categoryHeroes?: Record<string, string> } | undefined,
  page: HeroPage,
  category?: HeroCategory
): { value: string; from: 'category' | 'main' | 'page' } {
  const byCategory = settings?.categoryHeroes ?? {}
  // The shop with no category ("All"): the category photos, unless a product is chosen for "All"
  if (page === 'shop' && !category) return { value: byCategory[SHOP_ALL] || '', from: 'page' }
  if (page === 'shop' && category) {
    if (byCategory[category.slug]) return { value: byCategory[category.slug], from: 'category' }
    if (category.main && byCategory[category.main]) return { value: byCategory[category.main], from: 'main' }
  }
  // The old Shop page pin (pageHeroProducts.shop) is no longer used: a category picks its own
  if (page === 'shop') return { value: '', from: 'page' }
  return { value: settings?.pageHeroProducts?.[page] || '', from: 'page' }
}

/** Main categories first in the shop's "All" header (by address) */
export const ALL_ORDER = ['laptops', 'gaming-pcs', 'desktop-pcs', 'monitors', 'accessories', 'components', 'cameras']
/** Products in the rotating "All" header */
export const ALL_ROTATE_MAX = 6

/**
 * The shop's "All" header: one product per main category (in stock, featured first, the list's
 * best-seller order otherwise), computers first, at most 6 — a laptop, a gaming PC, a screen…
 */
export function onePerCategory(products: Product[], categories: Category[]): Product[] {
  const byMain = new Map<string, Product[]>()
  for (const p of products) {
    if (p.stock <= 0) continue
    const id = typeof p.category === 'object' ? p.category?._id : p.category
    const main = mainOf(categories, categories.find((c) => c._id === id))
    if (!main) continue
    const key = canonicalCategorySlug(main.slug)
    byMain.set(key, [...(byMain.get(key) ?? []), p])
  }
  const rank = (slug: string) => (ALL_ORDER.indexOf(slug) < 0 ? 99 : ALL_ORDER.indexOf(slug))
  return [...byMain.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([, list]) => pickCategoryHero(list))
    .filter((p): p is Product => Boolean(p))
    .slice(0, ALL_ROTATE_MAX)
}
