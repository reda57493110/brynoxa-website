import type { SiteIconName } from '@/components/ui/SiteIcon'

/**
 * "Pick your setup" (shop page /setups): gaming, study, work, creator.
 *
 * Which products a setup shows (setupsFor):
 * 1. Ticked in admin (Admin → Products → product → Setups) → exactly those setups.
 * 2. Otherwise by category. SETUP_CATEGORIES lists, per setup, the category addresses (exact, not
 *    their sub-categories) that can show there; the server returns those (?setup=).
 * 3. In categories used by several setups (SHARED: mice, keyboards, headsets, screens, laptops,
 *    accessories…) the product's own words decide: its name, tags and "use" spec
 *    ("Competitive gaming" → gaming; "Calls & music" → study and work). With no such words it
 *    shows on the setups whose NEUTRAL list has the category.
 *
 * SETUP_IDS and SETUP_CATEGORIES are the same as backend utils/setups.ts — keep both in sync.
 */
export const SETUP_IDS = ['gaming', 'study', 'work', 'creator'] as const
export type SetupId = (typeof SETUP_IDS)[number]

/** Categories that can show on each setup (server filter; the words decide inside SHARED ones) */
export const SETUP_CATEGORIES: Record<SetupId, string[]> = {
  gaming: [
    'gaming-pcs', 'gaming-pcs-1080p', 'gaming-pcs-1440p', 'gaming-pcs-4k', 'laptops', 'gaming-laptops',
    'monitors', 'gaming-monitors', 'curved-monitors',
    'components', 'graphics-cards', 'processors', 'ram', 'storage', 'motherboards', 'power-supplies', 'pc-cases', 'cooling',
    'mice', 'keyboards', 'headphones',
  ],
  study: [
    'laptops', 'student-laptops', 'business-laptops',
    'desktop-pc', 'desktop-pcs', 'mini-pcs', 'desktop-only', 'desktop-with-screen', 'desktop-screens', 'monitors', 'office-monitors',
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
    'gaming-pcs', 'gaming-pcs-1440p', 'gaming-pcs-4k', 'laptops', 'gaming-laptops',
    'monitors', 'curved-monitors',
    'components', 'graphics-cards', 'ram', 'storage',
    'camera', 'cameras', 'webcams', 'digital-cameras', 'action-cameras', 'camera-accessories',
    'headphones', 'hubs-docks',
  ],
}

/** Categories where the product's own words decide the setup */
export const SHARED_CATEGORIES = [
  'laptops', 'desktop-pc', 'desktop-pcs', 'mini-pcs', 'desktop-only', 'desktop-with-screen',
  'monitors', 'desktop-screens', 'curved-monitors',
  'mice', 'keyboards', 'headphones', 'webcams', 'storage',
  'accessories', 'hubs-docks', 'laptop-stands', 'cables-chargers', 'bags-sleeves',
]

/** Shared categories a product with no telling words shows in, per setup */
export const NEUTRAL_CATEGORIES: Record<SetupId, string[]> = {
  gaming: ['mice', 'keyboards', 'headphones', 'storage'],
  study: ['laptops', 'desktop-pc', 'desktop-pcs', 'mini-pcs', 'desktop-only', 'desktop-with-screen', 'desktop-screens', 'mice', 'keyboards', 'headphones', 'webcams', 'accessories', 'hubs-docks', 'laptop-stands', 'cables-chargers', 'bags-sleeves'],
  work: ['laptops', 'desktop-pc', 'desktop-pcs', 'mini-pcs', 'desktop-only', 'desktop-with-screen', 'desktop-screens', 'monitors', 'curved-monitors', 'mice', 'keyboards', 'headphones', 'webcams', 'storage', 'accessories', 'hubs-docks', 'laptop-stands', 'cables-chargers', 'bags-sleeves'],
  creator: ['monitors', 'curved-monitors', 'storage', 'webcams'],
}

/** Words that tie a product to a setup (English, French, Arabic; accents ignored) */
export const SETUP_WORDS: Record<SetupId, string[]> = {
  gaming: ['gaming', 'gamer', 'game', 'jeu', 'jeux', 'esport', 'mmo', 'fps', 'rgb', 'rtx', 'competitive', 'ألعاب', 'العاب', 'جيمنج'],
  study: ['study', 'student', 'school', 'university', 'learning', 'class', 'classes', 'calls', 'programming', 'programing', 'elitebook', 'elite book', 'probook', 'etude', 'etudes', 'etudiant', 'ecole', 'universite', 'cours', 'دراسة', 'طالب', 'طلاب', 'جامعة', 'مدرسة'],
  work: ['work', 'office', 'business', 'meeting', 'meetings', 'calls', 'programming', 'programing', 'elitebook', 'elite book', 'probook', 'latitude', 'thinkpad', 'travail', 'bureau', 'bureautique', 'entreprise', 'professionnel', 'teletravail', 'عمل', 'مكتب', 'شركة'],
  creator: ['creator', 'creators', 'creation', 'content', 'stream', 'streaming', 'video', 'videos', 'photo', 'editing', 'media', 'montage', 'createur', 'صناعة المحتوى', 'مونتاج', 'بث', 'تصوير'],
}

type SetupProduct = {
  name?: string
  tags?: string[]
  specs?: Record<string, string>
  setups?: string[]
  category?: unknown
}

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** The product's own words: name, tags and its "use" spec (not the long description) */
export function setupText(p: SetupProduct) {
  const use = Object.entries(p.specs ?? {})
    .filter(([k]) => /use|usage|utilisation|استعمال/i.test(k))
    .map(([, v]) => v)
  return plain([p.name ?? '', ...(p.tags ?? []), ...use].join(' · '))
}

/** Setups whose words appear in the text (a word, not inside another word: "work" ≠ "network") */
export function setupsByWords(text: string): SetupId[] {
  return SETUP_IDS.filter((id) =>
    SETUP_WORDS[id].some((w) => {
      const word = plain(w)
      let i = text.indexOf(word)
      while (i >= 0) {
        const before = i === 0 ? '' : text[i - 1]
        if (!/[a-z0-9]/.test(before)) return true
        i = text.indexOf(word, i + 1)
      }
      return false
    })
  )
}

export function categorySlugOf(p: SetupProduct): string | undefined {
  return p.category && typeof p.category === 'object' ? (p.category as { slug?: string }).slug : undefined
}

/** The setups a product shows on (see the top of this file) */
export function setupsFor(p: SetupProduct, slug = categorySlugOf(p)): SetupId[] {
  const ticked = SETUP_IDS.filter((id) => p.setups?.includes(id))
  if (ticked.length) return ticked
  if (!slug) return []
  const possible = SETUP_IDS.filter((id) => SETUP_CATEGORIES[id].includes(slug))
  if (!SHARED_CATEGORIES.includes(slug)) return possible
  const byWords = setupsByWords(setupText(p)).filter((id) => possible.includes(id))
  return byWords.length ? byWords : possible.filter((id) => NEUTRAL_CATEGORIES[id].includes(slug))
}

export const SETUP_ICON: Record<SetupId, SiteIconName> = { gaming: 'gamepad', study: 'laptop', work: 'monitor', creator: 'camera' }

/** Admin labels (the admin is in English) */
export const SETUP_ADMIN_LABEL: Record<SetupId, string> = { gaming: 'Gaming', study: 'Study', work: 'Work', creator: 'Streaming & creation' }

/** The kinds of product on a setup page, by category address; anything else = accessories */
export const SETUP_PIECE_IDS = ['pc', 'laptop', 'screen', 'mouse', 'keyboard', 'headset', 'webcam', 'camera', 'components', 'accessories'] as const
export type SetupPiece = (typeof SETUP_PIECE_IDS)[number]

const PIECE_OF: Record<string, SetupPiece> = {}
const add = (piece: SetupPiece, slugs: string[]) => slugs.forEach((s) => (PIECE_OF[s] = piece))
add('pc', ['gaming-pcs', 'gaming-pcs-1080p', 'gaming-pcs-1440p', 'gaming-pcs-4k', 'desktop-pc', 'desktop-pcs', 'mini-pcs', 'desktop-only', 'desktop-with-screen'])
add('laptop', ['laptops', 'gaming-laptops', 'student-laptops', 'business-laptops'])
add('screen', ['monitors', 'gaming-monitors', 'office-monitors', 'curved-monitors', 'desktop-screens'])
add('mouse', ['mice'])
add('keyboard', ['keyboards'])
add('headset', ['headphones'])
add('webcam', ['webcams'])
add('camera', ['camera', 'cameras', 'digital-cameras', 'action-cameras', 'camera-accessories'])
add('components', ['components', 'graphics-cards', 'processors', 'ram', 'storage', 'motherboards', 'power-supplies', 'pc-cases', 'cooling'])

export function setupPieceOf(categorySlug: string | undefined): SetupPiece {
  return (categorySlug && PIECE_OF[categorySlug]) || 'accessories'
}

/** The order of the groups, per setup: the main computer first, then what goes around it */
export const SETUP_PIECES: Record<SetupId, SetupPiece[]> = {
  gaming: ['pc', 'laptop', 'screen', 'mouse', 'keyboard', 'headset', 'components', 'webcam', 'accessories', 'camera'],
  study: ['laptop', 'pc', 'headset', 'mouse', 'keyboard', 'screen', 'webcam', 'accessories', 'components', 'camera'],
  work: ['laptop', 'pc', 'screen', 'keyboard', 'mouse', 'headset', 'webcam', 'accessories', 'components', 'camera'],
  creator: ['pc', 'laptop', 'camera', 'webcam', 'screen', 'headset', 'components', 'mouse', 'keyboard', 'accessories'],
}

export function isSetupId(value: unknown): value is SetupId {
  return typeof value === 'string' && (SETUP_IDS as readonly string[]).includes(value)
}

/**
 * A setup's whole list after one of its groups changed: the group's products go back into the
 * places the group had (in the new order), removed ones drop out, new ones go at the end.
 */
export function setupListAfter(all: string[], group: string[], nextGroup: string[]) {
  const inGroup = new Set(group)
  const kept = nextGroup.filter((id) => inGroup.has(id))
  const added = nextGroup.filter((id) => !inGroup.has(id) && !all.includes(id))
  let k = 0
  const out = all.map((id) => (inGroup.has(id) ? (kept[k++] ?? null) : id)).filter((id): id is string => Boolean(id))
  return [...out, ...added]
}
