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

/** The photo shown for a category: the one picked in admin, else the built-in one (if any). */
export function categoryPhoto(c: { slug: string; image?: string }): string | undefined {
  return c.image || BUILT_IN_CATEGORY_PHOTOS[c.slug]
}
