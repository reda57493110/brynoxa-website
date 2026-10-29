import type { HelpFaq, HelpGuide, HelpSection, HelpTopic } from './types'

/** Lower case, no accents, no Arabic short vowels / tatweel, single spaces: "Livraison à domicile" → "livraison a domicile". */
export function normalizeHelpText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const topicText = (t: HelpTopic) =>
  [t.title, t.summary, ...(t.steps ?? []), ...(t.points ?? []), t.keywords ?? ''].join(' ')

export type HelpSearchResult = {
  topics: { section: HelpSection; topic: HelpTopic; score: number }[]
  faqs: HelpFaq[]
}

/**
 * Topics and FAQs that contain every word of the query (in any order). Title matches rank first.
 * Very short words (1 letter) are ignored so "a", "à", "و" don't match everything.
 */
export function searchHelp(guide: HelpGuide, query: string): HelpSearchResult {
  const words = normalizeHelpText(query)
    .split(' ')
    .filter((w) => w.length > 1)
  if (!words.length) return { topics: [], faqs: [] }

  const matchesAll = (text: string) => {
    const hay = normalizeHelpText(text)
    return words.every((w) => hay.includes(w))
  }

  const topics: HelpSearchResult['topics'] = []
  for (const section of guide.sections) {
    for (const topic of section.topics) {
      if (!matchesAll(`${section.title} ${topicText(topic)}`)) continue
      const title = normalizeHelpText(topic.title)
      const score = words.filter((w) => title.includes(w)).length * 2 + (matchesAll(topic.keywords ?? '') ? 1 : 0)
      topics.push({ section, topic, score })
    }
  }
  topics.sort((a, b) => b.score - a.score)

  const faqs = guide.faqs.filter((f) => matchesAll(`${f.q} ${f.a}`))
  return { topics, faqs }
}

/** Every link used in the guide (for checks). */
export function helpLinks(guide: HelpGuide) {
  return [
    ...guide.guides.map((q) => q.action),
    ...guide.sections.flatMap((s) => s.topics.flatMap((t) => t.links ?? [])),
    ...guide.faqs.flatMap((f) => f.links ?? []),
  ]
}
