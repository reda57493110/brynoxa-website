/**
 * Compare page: which product wins each row. Kept free of imports so tests can load it directly.
 */

/** Specs where a smaller number is better. */
const LOWER_IS_BETTER = new Set(['response_time', 'cas_latency', 'weight_g'])
/** Number specs that are not "better" either way (shown, never highlighted). */
const NEUTRAL = new Set(['voltage', 'card_length', 'recommended_psu', 'ram_modules', 'impedance', 'tdp'])
/** Text specs that still hold a comparable size ("512 GB", "1 TB"). */
const SIZE_TEXT = new Set(['storage'])

/** A spec value as a number to compare, or null when it cannot be ranked. */
export function rankValue(key: string, value: string | undefined, numberField: boolean): number | null {
  if (!value?.trim() || NEUTRAL.has(key)) return null
  if (SIZE_TEXT.has(key)) {
    // "1 TB + 512 GB" → 1536 GB
    let total = 0
    let found = false
    for (const m of value.matchAll(/(\d+(?:[.,]\d+)?)\s*(TB|GB)/gi)) {
      total += parseFloat(m[1].replace(',', '.')) * (m[2].toUpperCase() === 'TB' ? 1024 : 1)
      found = true
    }
    return found ? total : null
  }
  if (!numberField) return null
  const n = parseFloat(value.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/**
 * Indexes of the winning products for one row (ties all win). No winner when fewer than two
 * products have a value, or when they are all equal.
 */
export function bestIndexes(values: Array<number | null>, lowerIsBetter: boolean): number[] {
  const ranked = values.map((v, i) => ({ v, i })).filter((x): x is { v: number; i: number } => x.v != null)
  if (ranked.length < 2) return []
  const target = lowerIsBetter ? Math.min(...ranked.map((x) => x.v)) : Math.max(...ranked.map((x) => x.v))
  const winners = ranked.filter((x) => x.v === target).map((x) => x.i)
  return winners.length === ranked.length ? [] : winners
}

export function isLowerBetter(key: string) {
  return LOWER_IS_BETTER.has(key)
}

/** The product with the most row wins (first one on a tie), or null when nobody stands out. */
export function overallPick(winsPerProduct: number[]): number | null {
  if (winsPerProduct.length < 2) return null
  const top = Math.max(...winsPerProduct)
  if (top <= 0) return null
  return winsPerProduct.filter((w) => w === top).length === 1 ? winsPerProduct.indexOf(top) : null
}
