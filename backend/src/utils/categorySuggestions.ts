/**
 * Suggested categories: Desktop PCs and Cameras (main ones), and sub-categories for the shop's main categories (by address). Admin → Settings →
 * Catalog → "Add suggested sub-categories" creates the missing ones under the categories that
 * exist; the owner can rename, hide or delete any of them after. French / Arabic names are in
 * the shop's translations (frontend i18n, catalog.categories), by the same address.
 */
export type CategorySuggestion = { slug: string; name: string; description: string };

/**
 * Addresses typed differently in admin, mapped to the one above ("Desktop PC" → desktop-pc →
 * desktop-pcs). Same list as frontend lib/categorySlug.ts.
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
};

export function canonicalCategorySlug(slug: string) {
  return CATEGORY_ALIASES[slug] ?? slug;
}

/** Main categories created by the same button when missing (the others already exist in the shop). */
export const MAIN_CATEGORY_SUGGESTIONS: CategorySuggestion[] = [
  { slug: 'desktop-pcs', name: 'Desktop PCs', description: 'Office desktop towers like the HP EliteDesk: reliable for work and study.' },
  { slug: 'cameras', name: 'Cameras', description: 'Security cameras, webcams and cameras for photos and video.' },
];

/**
 * Main categories that go inside another one: Mice, Headphones and Keyboards sit inside
 * Accessories (Desktop PCs keeps computers only). Moved by the same button, only while they have
 * no sub-categories of their own (two levels).
 */
export const MOVE_INSIDE: Record<string, string[]> = {
  accessories: ['mice', 'headphones', 'keyboards'],
};

export const CATEGORY_SUGGESTIONS: Record<string, CategorySuggestion[]> = {
  laptops: [
    { slug: 'business-laptops', name: 'Business laptops', description: 'HP EliteBook, ProBook, Dell Latitude: solid laptops for work and study.' },
    { slug: 'gaming-laptops', name: 'Gaming laptops', description: 'Laptops with a graphics card for games and creative work.' },
    { slug: 'student-laptops', name: 'Student / small budget', description: 'Reliable laptops for school, study and everyday use at a small price.' },
  ],
  'desktop-pcs': [
    { slug: 'mini-pcs', name: 'Mini PCs', description: 'Tiny desktops (HP EliteDesk Mini…) that fit behind a screen.' },
    { slug: 'desktop-with-screen', name: 'Desktop + screen', description: 'Complete set: the computer with its screen, keyboard and mouse.' },
    { slug: 'desktop-screens', name: 'Screens', description: 'Screens for your desktop PC, for the office and home.' },
    { slug: 'desktop-only', name: 'Desktop only', description: 'The computer alone (HP EliteDesk…), to use with your own screen.' },
  ],
  'gaming-pcs': [
    { slug: 'gaming-pcs-1080p', name: '1080p gaming PCs', description: 'Smooth Full HD gaming at a fair price.' },
    { slug: 'gaming-pcs-1440p', name: '1440p gaming PCs', description: 'High frame rates at 2K.' },
    { slug: 'gaming-pcs-4k', name: '4K gaming PCs', description: 'Top graphics cards for 4K and streaming.' },
  ],
  monitors: [
    { slug: 'office-monitors', name: 'Office monitors', description: 'Comfortable screens for work and study.' },
    { slug: 'gaming-monitors', name: 'Gaming monitors', description: 'High refresh rate screens for games.' },
    { slug: 'curved-monitors', name: 'Curved & ultrawide monitors', description: 'Wide screens for games and multitasking.' },
  ],
  components: [
    { slug: 'graphics-cards', name: 'Graphics cards', description: 'GPUs for gaming and creative work.' },
    { slug: 'processors', name: 'Processors', description: 'Intel and AMD CPUs.' },
    { slug: 'ram', name: 'RAM', description: 'DDR4 and DDR5 memory for desktops and laptops.' },
    { slug: 'storage', name: 'Storage (SSD & HDD)', description: 'NVMe and SATA SSDs, hard drives.' },
    { slug: 'motherboards', name: 'Motherboards', description: 'Boards for Intel and AMD processors.' },
    { slug: 'power-supplies', name: 'Power supplies', description: 'PSUs for every build.' },
    { slug: 'pc-cases', name: 'PC cases', description: 'Cases for every size of build.' },
    { slug: 'cooling', name: 'Cooling', description: 'CPU coolers, fans and water cooling.' },
  ],
  cameras: [
    { slug: 'security-cameras', name: 'Security cameras', description: 'Wi-Fi and wired cameras to watch your home or shop.' },
    { slug: 'webcams', name: 'Webcams', description: 'Webcams for calls and streaming.' },
    { slug: 'action-cameras', name: 'Action cameras', description: 'Small tough cameras for sport and travel.' },
    { slug: 'digital-cameras', name: 'Photo & video cameras', description: 'Compact, mirrorless and DSLR cameras.' },
    { slug: 'camera-accessories', name: 'Camera accessories', description: 'Memory cards, tripods, batteries and bags.' },
  ],
  accessories: [
    { slug: 'hubs-docks', name: 'Hubs & docking stations', description: 'USB-C hubs and docks for more ports.' },
    { slug: 'laptop-stands', name: 'Laptop stands', description: 'Raise your screen for a better posture.' },
    { slug: 'cables-chargers', name: 'Cables & chargers', description: 'Chargers, adapters and cables.' },
    { slug: 'bags-sleeves', name: 'Bags & sleeves', description: 'Carry your laptop safely.' },
    { slug: 'keyboards', name: 'Keyboards', description: 'Office and gaming keyboards.' },
  ],
};
