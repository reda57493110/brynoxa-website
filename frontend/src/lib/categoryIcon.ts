import type { SiteIconName } from '@/components/ui/SiteIcon'

/** Icon for a category, guessed from its slug / name (home tiles, shop category chips). */
export function categoryIcon(slug: string, name: string): SiteIconName {
  const key = `${slug} ${name}`.toLowerCase()
  if (key.includes('laptop')) return 'laptop'
  if (key.includes('gaming')) return 'gamepad'
  if (key.includes('monitor')) return 'monitor'
  if (key.includes('keyboard')) return 'keyboard'
  if (key.includes('mice') || key.includes('mouse')) return 'mouse'
  if (key.includes('headphone') || key.includes('audio')) return 'headphones'
  if (key.includes('component')) return 'cpu'
  return 'package'
}
