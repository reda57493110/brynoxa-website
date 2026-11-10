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

/**
 * Words that mean the same thing for a customer, in English, French, Arabic, and Moroccan Darija
 * (in Arabic letters and in Latin letters, e.g. "chhal", "nkhles", "fin wslat"). A word typed by the
 * customer also finds answers written with the other words of its group.
 */
export const HELP_SYNONYMS: string[][] = [
  ['order', 'orders', 'ordering', 'commande', 'commandes', 'commander', 'cmd', 'buy', 'purchase', 'acheter', 'achat', 'طلب', 'الطلب', 'طلبيه', 'كوموند', 'الكوموند', 'كومند', 'كومندا', 'نشري', 'شري', 'nchri', 'nchry', 'chri', 'checkout', 'cart', 'panier', 'السله', 'باني'],
  ['pay', 'payment', 'paying', 'paiement', 'payer', 'cash', 'cod', 'especes', 'espece', 'الدفع', 'دفع', 'نخلص', 'خلص', 'نخلص', 'تخلص', 'الخلاص', 'خلاص', 'nkhles', 'khles', 'khlas', 'nkhless', 'flous', 'flouss', 'فلوس', 'money', 'argent', 'card', 'carte', 'كارط', 'لاكارط'],
  ['deposit', 'acompte', 'avance', 'advance', 'عربون', 'العربون', 'تسبيق', 'التسبيق', 'tasbiq', 'arboun', '3arboun', 'virement', 'transfer', 'تحويل'],
  ['delivery', 'deliver', 'delivered', 'shipping', 'ship', 'livraison', 'livrer', 'livre', 'livreur', 'courier', 'coursier', 'التوصيل', 'توصيل', 'يوصل', 'توصل', 'توصلني', 'tawsil', 'twsil', 'tewsil', 'ليفريزون', 'livrezon', 'delai', 'delay', 'days', 'jours', 'ايام', 'نهار', 'nhar', 'city', 'ville', 'مدينه', 'لمدينه'],
  ['track', 'tracking', 'follow', 'where', 'status', 'suivi', 'suivre', 'statut', 'ou', 'تتبع', 'تتبع', 'نتبع', 'فين', 'fin', 'wslat', 'wsalt', 'وصلات', 'وصلت', 'وصل', 'mchat', 'مشات', 'حاله', 'number', 'numero', 'نمره', 'رقم', 'nmra', 'raqm'],
  ['return', 'returns', 'refund', 'refunds', 'exchange', 'retour', 'retourner', 'rembourser', 'remboursement', 'echange', 'echanger', 'ارجاع', 'الارجاع', 'استرجاع', 'رجع', 'نرجع', 'نرجعو', 'رجوع', 'rja3', 'rj3', 'nraja3', 'nrj3', 'rje3', 'tbdal', 'nbdel', 'بدل', 'نبدل', 'تبديل', 'flousi', 'فلوسي'],
  ['warranty', 'guarantee', 'guaranty', 'garantie', 'garanti', 'garanty', 'ضمان', 'الضمان', 'damana', 'daman', 'ضمانه', 'broken', 'faulty', 'defect', 'defective', 'panne', 'casse', 'defaut', 'khaser', 'khasr', 'خاسر', 'خسر', 'تخسر', 'mkhsour', 'مخسور', 'ma khdamch', 'ماخدامش', 'repair', 'reparation', 'reparer', 'صلاح', 'نصلح', 'تصليح', 'sla7', 'nsle7'],
  ['account', 'login', 'signin', 'sign', 'register', 'password', 'compte', 'connexion', 'connecter', 'inscription', 'inscrire', 'motdepasse', 'حساب', 'الحساب', 'كونط', 'الكونط', 'kont', 'compt', 'مودباس', 'modpass', 'code', 'كود', 'email', 'mail', 'ايميل'],
  ['price', 'prices', 'cost', 'costs', 'fee', 'fees', 'free', 'prix', 'cout', 'tarif', 'frais', 'gratuit', 'combien', 'ثمن', 'الثمن', 'سعر', 'شحال', 'chhal', 'ch7al', 'chhal', 'taman', 'tamane', 'thaman', 'بشحال', 'bchhal', 'bch7al', 'فابور', 'fabour', 'majani', 'مجاني'],
  ['cancel', 'cancelled', 'annuler', 'annulation', 'annule', 'الغاء', 'نلغي', 'لغي', 'نلغيه', 'lgha', 'nlghi', 'nlgha', 'بطل', 'نبطل', 'nbtel'],
  ['contact', 'whatsapp', 'whats', 'watsap', 'wtsp', 'phone', 'call', 'telephone', 'appeler', 'appel', 'joindre', 'تيليفون', 'تلفون', 'هاتف', 'اتصل', 'نتاصل', 'نعيط', 'عيط', 'n3iyet', '3iyet', 'tilifon', 'واتساب', 'واتس'],
  ['coupon', 'promo', 'promotion', 'discount', 'remise', 'reduction', 'solde', 'soldes', 'تخفيض', 'تخفيضات', 'برومو', 'بروموسيون', 'روميز', 'remiz', 'promotion', 'deal', 'deals'],
  ['product', 'products', 'stock', 'available', 'availability', 'produit', 'produits', 'disponible', 'dispo', 'منتوج', 'المنتوج', 'منتج', 'سلعه', 'السلعه', 'sel3a', 'kayn', 'كاين', 'specs', 'caracteristiques', 'refurbished', 'reconditionne', 'occasion', 'used', 'مستعمل', 'جديد'],
]

/** Words that say nothing about the question ("how do I…", "kifach…", "wach…") */
const STOP_WORDS = new Set(
  normalizeHelpText(
    [
      'how do does did can could i me my mine you your we our the a an to of in on at for is are be it this that with what which when will would should please and or not',
      'comment est ce que qu je j me moi mon ma mes tu ton ta tes vous votre nous le la les l de du des un une au aux en et ou pour par sur avec dans quoi quel quelle quand puis peut peux faire svp',
      'kifach kifax kifch kif wach wech ach ash chno chnou chnu ana nta nti ntoma dyali dyal dial dyalek dyalk f fi l li ila ila bghit bghina 3afak afak momkin mumkin had hadi hada',
      'كيفاش كيف واش اش شنو شنوا انا نتا نتي ديالي ديال ديالك ف في ل لي اذا الا بغيت بغينا عافاك ممكن هاد هادي هادا من الى على عن هل ما ماذا كيف متى كم هو هي',
    ].join(' ')
  ).split(' ')
)

/** Typing mistakes allowed: one for words of 4–6 letters, two for longer ones */
function closeEnough(a: string, b: string) {
  if (a === b) return true
  const max = a.length >= 7 ? 2 : a.length >= 4 ? 1 : 0
  if (!max || Math.abs(a.length - b.length) > max) return false
  // Levenshtein distance, stopping early once it is too big
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      best = Math.min(best, cur[j])
    }
    if (best > max) return false
    prev = cur
  }
  return prev[b.length] <= max
}

const GROUPS = HELP_SYNONYMS.map((g) => [...new Set(g.map(normalizeHelpText).filter(Boolean))])

/** The word, plus the words of its synonym group(s) when it belongs to one (typos included) */
export function expandHelpWord(word: string): string[] {
  const out = new Set([word])
  for (const group of GROUPS) {
    if (group.some((g) => g === word || (word.length >= 4 && (g.startsWith(word) || closeEnough(word, g))))) {
      for (const g of group) out.add(g)
    }
  }
  return [...out]
}

/** Does the text (already normalized) contain one of these words, or a word close to one? */
function textHas(hay: string, hayWords: string[], candidates: string[]) {
  return candidates.some((c) => (c.length >= 3 ? hay.includes(c) : hayWords.includes(c)) || (c.length >= 4 && hayWords.some((h) => closeEnough(c, h))))
}

const topicText = (t: HelpTopic) =>
  [t.title, t.summary, ...(t.steps ?? []), ...(t.points ?? []), t.keywords ?? ''].join(' ')

export type HelpSearchResult = {
  topics: { section: HelpSection; topic: HelpTopic; score: number }[]
  faqs: HelpFaq[]
}

/** The words of a question that carry meaning (no "how / kifach / est-ce que…") */
export function questionWords(query: string) {
  const words = normalizeHelpText(query)
    .split(' ')
    .filter((w) => w.length > 1)
  const meaningful = words.filter((w) => !STOP_WORDS.has(w))
  return meaningful.length ? meaningful : words.filter((w) => w.length > 2)
}

/**
 * Answers for what the customer typed, best first. Each word may match itself, a word of the same
 * meaning (French, Arabic, Darija in Arabic or Latin letters: "chhal livraison", "fin commande
 * dyali"), or a word with a typing mistake. An answer is kept when it matches at least half of the
 * question's words (all of them for a single word); words in its title count most.
 */
export function searchHelp(guide: HelpGuide, query: string): HelpSearchResult {
  const words = questionWords(query)
  if (!words.length) return { topics: [], faqs: [] }
  const expanded = words.map(expandHelpWord)
  const needed = Math.max(1, Math.ceil(words.length / 2))

  const rate = (title: string, body: string, keywords: string) => {
    const t = normalizeHelpText(title)
    const b = normalizeHelpText(body)
    const k = normalizeHelpText(keywords)
    const tw = t.split(' ')
    const bw = b.split(' ')
    const kw = k.split(' ')
    let matched = 0
    let score = 0
    expanded.forEach((cands, i) => {
      // The exact word counts a little more than a word of the same meaning
      const exact = [words[i]]
      const inTitle = textHas(t, tw, cands)
      const inKeywords = textHas(k, kw, cands)
      const inBody = inTitle || inKeywords || textHas(b, bw, cands)
      if (!inBody) return
      matched += 1
      score += (inTitle ? 3 : 0) + (inKeywords ? 2 : 0) + 1 + (textHas(`${t} ${k} ${b}`, [...tw, ...kw, ...bw], exact) ? 1 : 0)
    })
    return { matched, score }
  }

  const topics: HelpSearchResult['topics'] = []
  for (const section of guide.sections) {
    for (const topic of section.topics) {
      const r = rate(topic.title, `${section.title} ${topicText(topic)}`, topic.keywords ?? '')
      if (r.matched < needed) continue
      topics.push({ section, topic, score: r.matched * 10 + r.score })
    }
  }
  topics.sort((a, b) => b.score - a.score)

  const faqs = guide.faqs
    .map((f) => ({ f, r: rate(f.q, f.a, '') }))
    .filter((x) => x.r.matched >= needed)
    .sort((a, b) => b.r.matched * 10 + b.r.score - (a.r.matched * 10 + a.r.score))
    .map((x) => x.f)
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
