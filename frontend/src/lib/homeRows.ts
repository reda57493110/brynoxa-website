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
