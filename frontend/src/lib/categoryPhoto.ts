/** Built-in photos for the store's main categories (by address), used until the owner sets one. */
export const BUILT_IN_CATEGORY_PHOTOS: Record<string, string> = {
  laptops: '/categories/laptops.webp',
  'gaming-pcs': '/categories/gaming-pcs.webp',
  monitors: '/categories/monitors.jpg',
  keyboards: '/categories/keyboards.jpg',
  mice: '/categories/mice.jpg',
  headphones: '/categories/headphones.jpg',
  components: '/categories/components.jpg',
  accessories: '/categories/accessories.jpg',
}

/** Width of each built-in photo's larger copy (some originals are under 960 px). */
const BUILT_IN_LARGE_WIDTH: Record<string, number> = { accessories: 679, headphones: 736, mice: 735, monitors: 736 }

/**
 * Smaller copies of a built-in photo (public/categories/<slug>-480.webp and -960.webp), so phones
 * do not download the full-size original. Undefined for photos picked in admin.
 */
export function categoryPhotoSrcSet(c: { slug: string; image?: string }): string | undefined {
  if (c.image) return undefined
  const original = BUILT_IN_CATEGORY_PHOTOS[c.slug]
  if (!original) return undefined
  const base = original.replace(/\.[^.]+$/, '')
  return `${base}-480.webp 480w, ${base}-960.webp ${BUILT_IN_LARGE_WIDTH[c.slug] ?? 960}w`
}

/** The photo shown for a category: the one picked in admin, else the built-in one (if any). */
export function categoryPhoto(c: { slug: string; image?: string }): string | undefined {
  return c.image || BUILT_IN_CATEGORY_PHOTOS[c.slug]
}
