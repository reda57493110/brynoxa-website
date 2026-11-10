/**
 * "Pick your setup" (shop page /setups): gaming, study, work, creator. A product belongs to the
 * setups staff ticked on it (Admin → Products → product → Setups). A product with none ticked
 * goes by its category: SETUP_CATEGORIES lists, per setup, the category addresses (exact, not
 * their sub-categories) whose untagged products show there.
 * Same list as frontend lib/setups.ts — keep both copies in sync.
 */
export const SETUP_IDS = ['gaming', 'study', 'work', 'creator'] as const;
export type SetupId = (typeof SETUP_IDS)[number];

export const SETUP_CATEGORIES: Record<SetupId, string[]> = {
  gaming: [
    'gaming-pcs', 'gaming-pcs-1080p', 'gaming-pcs-1440p', 'gaming-pcs-4k', 'gaming-laptops',
    'monitors', 'gaming-monitors', 'curved-monitors',
    'components', 'graphics-cards', 'processors', 'ram', 'storage', 'motherboards', 'power-supplies', 'pc-cases', 'cooling',
    'mice', 'keyboards', 'headphones',
  ],
  study: [
    'laptops', 'student-laptops', 'business-laptops',
    'desktop-pc', 'desktop-pcs', 'mini-pcs', 'desktop-only', 'desktop-with-screen', 'desktop-screens', 'office-monitors',
    'mice', 'keyboards', 'headphones',
    'accessories', 'laptop-stands', 'bags-sleeves', 'hubs-docks', 'cables-chargers', 'webcams',
  ],
  work: [
    'laptops', 'business-laptops',
    'desktop-pc', 'desktop-pcs', 'mini-pcs', 'desktop-only', 'desktop-with-screen', 'desktop-screens',
    'monitors', 'office-monitors', 'curved-monitors',
    'mice', 'keyboards', 'headphones', 'webcams',
    'accessories', 'hubs-docks', 'laptop-stands', 'cables-chargers', 'bags-sleeves', 'storage',
  ],
  creator: [
    'gaming-pcs', 'gaming-pcs-1440p', 'gaming-pcs-4k', 'gaming-laptops',
    'monitors', 'curved-monitors',
    'components', 'graphics-cards', 'ram', 'storage',
    'camera', 'cameras', 'webcams', 'digital-cameras', 'action-cameras', 'camera-accessories',
    'headphones', 'hubs-docks',
  ],
};

export function isSetupId(value: unknown): value is SetupId {
  return typeof value === 'string' && (SETUP_IDS as readonly string[]).includes(value);
}

/** The setups ticked on a product: known ones only, no repeats, in the usual order. */
export function sanitizeSetups(value: unknown): SetupId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return SETUP_IDS.filter((id) => value.includes(id));
}
