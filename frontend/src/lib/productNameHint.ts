/**
 * Admin product form: a gentle tip when the product name will be hard to find on Google.
 * People search for the model and specs ("HP EliteBook 840 G8 i7 16GB"), not just a brand.
 * Kept free of imports so tests can load it directly.
 */
export type NameHint = 'too_short' | 'brand_only' | 'too_long' | null

export function productNameHint(name: string, brand = ''): NameHint {
  const n = name.trim().replace(/\s+/g, ' ')
  if (!n) return null
  const b = brand.trim().toLowerCase()
  if (b && n.toLowerCase() === b) return 'brand_only'
  // Google shows about 60–70 characters of a title (the page adds "— Brynoxa")
  if (n.length > 70) return 'too_long'
  const words = n.split(' ').length
  // A model name almost always has a number (840 G8, A15, 27"); short names without one are vague
  if (words < 3 || n.length < 12 || (words <= 3 && !/\d/.test(n))) return 'too_short'
  return null
}
