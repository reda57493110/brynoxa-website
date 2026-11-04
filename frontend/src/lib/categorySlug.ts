/**
 * Category addresses typed differently in admin, mapped to the one the shop knows (names in
 * French / Arabic, built-in photo, icon). "Desktop PC" → desktop-pc → desktop-pcs.
 * Same list as backend utils/categorySuggestions.ts (CATEGORY_ALIASES).
 */
export const CATEGORY_ALIASES: Record<string, string> = {
  'desktop-pc': 'desktop-pcs',
  desktop: 'desktop-pcs',
  desktops: 'desktop-pcs',
  'desktop-computers': 'desktop-pcs',
  camera: 'cameras',
  laptop: 'laptops',
  'gaming-pc': 'gaming-pcs',
  monitor: 'monitors',
  mouse: 'mice',
  keyboard: 'keyboards',
  headphone: 'headphones',
  component: 'components',
  accessory: 'accessories',
}

export function canonicalCategorySlug(slug: string) {
  return CATEGORY_ALIASES[slug] ?? slug
}
