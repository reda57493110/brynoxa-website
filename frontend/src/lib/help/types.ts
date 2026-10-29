/**
 * Help Center content (route /help). One file per language (en.ts, fr.ts, ar.ts) with the same
 * section and topic ids, so links like /help#track-order work in every language.
 *
 * Rules for editing: describe only what the site really does, and link to the page that is the
 * source of truth (Terms of Sale, service pages) instead of copying policies. Every `to` must be a
 * real store route — tests/help-guide.test.mts checks the links and that the three languages match.
 */

export type HelpLink = {
  /** A store route (no language prefix), optionally with #anchor — e.g. '/terms#returns' */
  to: string
  label: string
}

export type HelpTopic = {
  id: string
  title: string
  /** One or two sentences, shown first */
  summary: string
  /** Numbered steps for a workflow */
  steps?: string[]
  /** Short points */
  points?: string[]
  /** Extra words people may search with (synonyms, other spellings) */
  keywords?: string
  links?: HelpLink[]
}

export type HelpSectionIcon =
  | 'search'
  | 'monitor'
  | 'user'
  | 'cart'
  | 'package'
  | 'banknote'
  | 'truck'
  | 'shield'
  | 'wrench'
  | 'chat'

export type HelpSection = {
  id: string
  icon: HelpSectionIcon
  title: string
  description: string
  topics: HelpTopic[]
}

export type HelpFaq = {
  id: string
  q: string
  a: string
  links?: HelpLink[]
}

export type HelpGuide = {
  sections: HelpSection[]
  faqs: HelpFaq[]
}
