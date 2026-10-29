import type { Locale } from '@/i18n'
import type { HelpGuide } from './types'

export type { HelpFaq, HelpGuide, HelpGuideId, HelpLink, HelpQuickGuide, HelpSection, HelpTopic } from './types'
export { searchHelp, normalizeHelpText } from './search'
export { guideForPath } from './context'

/** Each language is its own small file, downloaded only when the help opens in that language. */
export async function loadHelpGuide(locale: Locale): Promise<HelpGuide> {
  if (locale === 'fr') return (await import('./fr')).fr
  if (locale === 'ar') return (await import('./ar')).ar
  return (await import('./en')).en
}

/** React Query key + loader shared by the Help Center page and the Help button. */
export const helpGuideQuery = (locale: Locale) => ({
  queryKey: ['help-guide', locale] as const,
  queryFn: () => loadHelpGuide(locale),
  staleTime: Infinity,
})
