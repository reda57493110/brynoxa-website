import { canonicalCategorySlug } from './categorySlug'

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
  // New file name when the photo changes: phones keep these photos for a week
  'desktop-pcs': '/categories/desktop-pcs-v2.webp',
  cameras: '/categories/cameras.webp',
}

/**
 * Built-in photos whose licence asks for a credit (CC BY-SA): shown under the home categories
 * while the photo is used (a photo set in admin needs none).
 */
export const BUILT_IN_PHOTO_CREDITS: Record<string, { author: string; licence: string; source: string; licenceUrl: string; edited?: boolean }> = {
  'desktop-pcs': {
    author: 'Miguel Durán (Museo8bits)',
    licence: 'CC BY-SA 4.0',
    source: 'https://commons.wikimedia.org/wiki/File:HP_EliteDesk_800_35_W_G2_mini_003.jpg',
    licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    edited: true,
  },
}

/** The credit for a category's photo, when it is a built-in photo that needs one. */
export function categoryPhotoCredit(c: { slug: string; image?: string }) {
  return c.image ? undefined : BUILT_IN_PHOTO_CREDITS[canonicalCategorySlug(c.slug)]
}

/** Width of each built-in photo's larger copy (some originals are under 960 px). */
const BUILT_IN_LARGE_WIDTH: Record<string, number> = { accessories: 679, headphones: 736, mice: 735, monitors: 736 }

/**
 * Smaller copies of a built-in photo (public/categories/<slug>-480.webp and -960.webp), so phones
 * do not download the full-size original. Undefined for photos picked in admin.
 */
export function categoryPhotoSrcSet(c: { slug: string; image?: string }): string | undefined {
  if (c.image) return undefined
  const slug = canonicalCategorySlug(c.slug)
  const original = BUILT_IN_CATEGORY_PHOTOS[slug]
  if (!original) return undefined
  const base = original.replace(/\.[^.]+$/, '')
  return `${base}-480.webp 480w, ${base}-960.webp ${BUILT_IN_LARGE_WIDTH[slug] ?? 960}w`
}

/** The photo shown for a category: the one picked in admin, else the built-in one (if any). */
export function categoryPhoto(c: { slug: string; image?: string }): string | undefined {
  return c.image || BUILT_IN_CATEGORY_PHOTOS[canonicalCategorySlug(c.slug)]
}
