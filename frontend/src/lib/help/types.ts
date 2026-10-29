/**
 * Help Center content (route /help, and the Help button on every shop page). One file per language
 * (en.ts, fr.ts, ar.ts) with the same ids, so links like /help#track-order work in every language.
 *
 * Rules for editing: keep it short and simple, describe only what the site really does, and link to
 * the page that is the source of truth (Terms of Sale, service pages) instead of copying policies.
 * Every `to` must be a real store route — tests/help-guide.test.mts checks the links and that the
 * three languages match.
 */

export type HelpLink = {
  /** A store route (no language prefix), optionally with #anchor — e.g. '/terms#returns' */
  to: string
  label: string
}

export type HelpIcon =
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
  | 'phone'
  | 'check'
  | 'refresh'
  | 'package-check'

/** The five things customers ask most: shown first on /help and in the Help button panel. */
export type HelpGuideId = 'order' | 'pay' | 'track' | 'return' | 'account'

export type HelpQuickGuide = {
  id: HelpGuideId
  icon: HelpIcon
  title: string
  /** One sentence under the title */
  intro: string
  steps: { icon: HelpIcon; title: string; text: string }[]
  /** A short extra line (optional) */
  note?: string
  /** The button that lets the customer do it now */
  action: HelpLink
  /** Topic id with more details */
  more: string
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

export type HelpSection = {
  id: string
  icon: HelpIcon
  title: string
  topics: HelpTopic[]
}

export type HelpFaq = {
  id: string
  q: string
  a: string
  links?: HelpLink[]
}

export type HelpGuide = {
  guides: HelpQuickGuide[]
  sections: HelpSection[]
  faqs: HelpFaq[]
}
