import type { Product } from '@/types'

/** Biggest real discount in the row, in % (old price → price), rounded down. */
export function bestDiscount(products: Product[]) {
  return products.reduce((best, p) => {
    const was = p.compareAtPrice ?? 0
    return was > p.price ? Math.max(best, Math.floor((1 - p.price / was) * 100)) : best
  }, 0)
}

/** Newest "added" date in the row. */
export function latestAdded(products: Product[]) {
  const times = products.map((p) => (p.createdAt ? Date.parse(p.createdAt) : NaN)).filter((n) => !Number.isNaN(n))
  return times.length ? new Date(Math.max(...times)) : null
}

/** "Shop by budget" price bands, in DH (min included, max excluded). */
type Budget = { id: string; label: 'home.budgetUnder' | 'home.budgetBetween' | 'home.budgetOver'; min?: number; max?: number }

export const BUDGETS: readonly Budget[] = [
  { id: 'small', label: 'home.budgetUnder', max: 3000 },
  { id: 'mid', label: 'home.budgetBetween', min: 3000, max: 8000 },
  { id: 'high', label: 'home.budgetOver', min: 8000 },
]

export function inBudget(price: number, b: { min?: number; max?: number }) {
  return (b.min === undefined || price >= b.min) && (b.max === undefined || price < b.max)
}
