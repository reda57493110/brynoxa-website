import type { Locale } from '@/i18n'
import type { HelpGuide } from './types'

export type { HelpFaq, HelpGuide, HelpLink, HelpSection, HelpTopic } from './types'
export { searchHelp, normalizeHelpText } from './search'

/** Each language is its own small file, downloaded only when the Help Center opens in that language. */
export async function loadHelpGuide(locale: Locale): Promise<HelpGuide> {
  if (locale === 'fr') return (await import('./fr')).fr
  if (locale === 'ar') return (await import('./ar')).ar
  return (await import('./en')).en
}
