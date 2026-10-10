import type { ProductCondition } from '@/types'

/** True when a listing / line sells refurbished or used units (anything that is not new). */
export function isPreOwned(
  condition?: ProductCondition | null
): condition is Exclude<ProductCondition, 'new'> {
  return condition === 'refurbished' || condition === 'used'
}
