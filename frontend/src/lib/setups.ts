import type { SiteIconName } from '@/components/ui/SiteIcon'

/**
 * "Pick your setup" (shop page /setups): gaming, study, work, creator. A product belongs to the
 * setups staff ticked on it (Admin → Products → product → Setups); one with none ticked goes by
 * its category (SETUP_CATEGORIES: exact addresses, not their sub-categories).
 * Same lists as backend utils/setups.ts — keep both copies in sync.
 */
export const SETUP_IDS = ['gaming', 'study', 'work', 'creator'] as const
export type SetupId = (typeof SETUP_IDS)[number]

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
}

export const SETUP_ICON: Record<SetupId, SiteIconName> = { gaming: 'gamepad', study: 'laptop', work: 'monitor', creator: 'camera' }

/** Admin labels (the admin is in English) */
export const SETUP_ADMIN_LABEL: Record<SetupId, string> = { gaming: 'Gaming', study: 'Study', work: 'Work', creator: 'Streaming & creation' }

/** The parts of a setup page, by category address; anything else goes in "accessories". */
export type SetupPiece = 'computer' | 'screen' | 'gear' | 'components' | 'cameras' | 'accessories'

const PIECE_OF: Record<string, SetupPiece> = {}
const add = (piece: SetupPiece, slugs: string[]) => slugs.forEach((s) => (PIECE_OF[s] = piece))
add('computer', ['gaming-pcs', 'gaming-pcs-1080p', 'gaming-pcs-1440p', 'gaming-pcs-4k', 'laptops', 'gaming-laptops', 'student-laptops', 'business-laptops', 'desktop-pc', 'desktop-pcs', 'mini-pcs', 'desktop-only', 'desktop-with-screen'])
add('screen', ['monitors', 'gaming-monitors', 'office-monitors', 'curved-monitors', 'desktop-screens'])
add('gear', ['mice', 'keyboards', 'headphones'])
add('components', ['components', 'graphics-cards', 'processors', 'ram', 'storage', 'motherboards', 'power-supplies', 'pc-cases', 'cooling'])
add('cameras', ['camera', 'cameras', 'webcams', 'digital-cameras', 'action-cameras', 'camera-accessories'])

export function setupPieceOf(categorySlug: string | undefined): SetupPiece {
  return (categorySlug && PIECE_OF[categorySlug]) || 'accessories'
}

/** The order the parts are shown in, per setup */
export const SETUP_PIECES: Record<SetupId, SetupPiece[]> = {
  gaming: ['computer', 'screen', 'gear', 'components', 'accessories', 'cameras'],
  study: ['computer', 'gear', 'accessories', 'screen', 'cameras', 'components'],
  work: ['computer', 'screen', 'gear', 'accessories', 'cameras', 'components'],
  creator: ['computer', 'cameras', 'screen', 'gear', 'components', 'accessories'],
}

export function isSetupId(value: unknown): value is SetupId {
  return typeof value === 'string' && (SETUP_IDS as readonly string[]).includes(value)
}
