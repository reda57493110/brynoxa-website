import { sizedImageUrl } from './image'
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
  // Made by the owner (AI image, no logos); wall and desk extended to the sides for the wide tile
  'desktop-pcs': '/categories/desktop-pcs-v10.webp',
  cameras: '/categories/cameras.webp',
}

/**
 * Sub-categories with a photo of their own (public/categories/sub/<address>.webp, 1200 px, with
 * -480 / -960 copies): RAM shows RAM sticks, Security cameras a security camera…
 */
export const SUB_CATEGORY_PHOTOS = [
  'business-laptops',
  'gaming-laptops',
  'student-laptops',
  'mini-pcs',
  'desktop-with-screen',
  'desktop-only',
  'gaming-pcs-1080p',
  'gaming-pcs-1440p',
  'gaming-pcs-4k',
  'office-monitors',
  'gaming-monitors',
  'curved-monitors',
  'graphics-cards',
  'processors',
  'ram',
  'storage',
  'motherboards',
  'power-supplies',
  'pc-cases',
  'cooling',
  'security-cameras',
  'webcams',
  'action-cameras',
  'digital-cameras',
  'camera-accessories',
  'hubs-docks',
  'laptop-stands',
  'cables-chargers',
  'bags-sleeves',
] as const
for (const s of SUB_CATEGORY_PHOTOS) BUILT_IN_CATEGORY_PHOTOS[s] = `/categories/sub/${s}.webp`

/**
 * Built-in photos whose licence asks for a credit (CC BY-SA): shown under the home categories
 * while the photo is used (a photo set in admin needs none).
 */
export const BUILT_IN_PHOTO_CREDITS: Record<string, { author: string; licence: string; source: string; licenceUrl: string; edited?: boolean }> = {}

/**
 * Where a built-in photo is framed in its tile (CSS object-position): keeps every element in view
 * in the wide home tile (screen, computer, keyboard, mouse). Default: the centre.
 */
const BUILT_IN_PHOTO_POSITION: Record<string, string> = {}

export function categoryPhotoPosition(c: { slug: string; image?: string }) {
  return c.image ? undefined : BUILT_IN_PHOTO_POSITION[canonicalCategorySlug(c.slug)]
}

/** The credit for a category's photo, when it is a built-in photo that needs one. */
export function categoryPhotoCredit(c: { slug: string; image?: string }) {
  return c.image ? undefined : BUILT_IN_PHOTO_CREDITS[canonicalCategorySlug(c.slug)]
}

/** Built-in originals sharp enough for phone screens (3× pixels): offered as the largest size. */
const BUILT_IN_ORIGINAL_WIDTH: Record<string, number> = {
  'desktop-pcs': 2128,
  ...Object.fromEntries(SUB_CATEGORY_PHOTOS.map((s) => [s, 1200])),
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
  const large = BUILT_IN_ORIGINAL_WIDTH[slug] ? `, ${original} ${BUILT_IN_ORIGINAL_WIDTH[slug]}w` : ''
  return `${base}-480.webp 480w, ${base}-960.webp ${BUILT_IN_LARGE_WIDTH[slug] ?? 960}w${large}`
}

type PhotoCategory = { _id?: string; slug: string; image?: string; parent?: string | PhotoCategory | null }

/**
 * The photo shown for a category: the one picked in admin, else the built-in one, else (for a
 * sub-category) its main category's photo — "Business laptops" shows the Laptops photo until it
 * gets its own. `all`: the category list, to find the main category by id.
 */
export function categoryPhoto(c: PhotoCategory, all: PhotoCategory[] = []): string | undefined {
  const own = c.image || BUILT_IN_CATEGORY_PHOTOS[canonicalCategorySlug(c.slug)]
  if (own || !c.parent) return own
  const parent = typeof c.parent === 'string' ? all.find((x) => x._id === c.parent) : c.parent
  return parent ? parent.image || BUILT_IN_CATEGORY_PHOTOS[canonicalCategorySlug(parent.slug)] : undefined
}

/** A small copy of the category photo, for chips (the built-in 480 px copy, or the admin photo resized). */
export function categoryThumb(c: PhotoCategory, all: PhotoCategory[] = []): string | undefined {
  const photo = categoryPhoto(c, all)
  if (!photo) return undefined
  return photo.startsWith('/categories/') ? photo.replace(/\.(webp|jpg)$/, '-480.webp') : sizedImageUrl(photo, 160)
}
