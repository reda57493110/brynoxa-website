import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';

/**
 * "Complete your setup" recommendations.
 *
 * Every product is classified into a kind (laptop, mouse, usb-hub, …) from its category,
 * tags, name and `specs.Use`. COMPLEMENTS lists, per kind, which kinds go with it in
 * priority order. New products are picked up automatically as long as their name or
 * tags say what they are (e.g. tag "mouse", "headset", "gaming").
 */

type Kind =
  | 'gaming-pc'
  | 'desktop'
  | 'laptop'
  | 'monitor'
  | 'mousepad'
  | 'keyboard-mouse'
  | 'keyboard'
  | 'mouse'
  | 'headset'
  | 'speakers'
  | 'webcam'
  | 'monitor-arm'
  | 'light-bar'
  | 'laptop-bag'
  | 'laptop-stand'
  | 'cooling-pad'
  | 'usb-hub'
  | 'external-ssd'
  | 'wifi-adapter'
  | 'cable'
  | 'accessory';

/** Category slugs that decide the kind on their own. */
const CATEGORY_KINDS: Record<string, Kind> = {
  'gaming-pcs': 'gaming-pc',
  laptops: 'laptop',
  monitors: 'monitor',
};

/** Keyword rules, most specific first (e.g. mouse pad before mouse, hub before cable). */
const KEYWORD_KINDS: [Kind, RegExp][] = [
  ['mousepad', /mouse ?pad|desk ?mat|tapis de souris/],
  ['keyboard-mouse', /combo|keyboard (and|&|\+) mouse|clavier (et|&|\+) souris/],
  ['monitor-arm', /monitor (arm|stand|mount)|bras (d'|d’|de )?[ée]cran|support (d'|d’)?[ée]cran|vesa/],
  ['light-bar', /light ?bar|screen ?bar|lampe (d'|d’)?[ée]cran/],
  ['laptop-bag', /laptop (bag|sleeve|backpack)|backpack|sleeve|sacoche|sac (à|a) dos/],
  ['laptop-stand', /laptop stand|support (pc |ordinateur )?portable|\bstand\b/],
  ['cooling-pad', /cooling ?pad|cooler pad|refroidisseur/],
  ['usb-hub', /\bhub\b|\bdock\b|docking|chargedock|station d'accueil/],
  ['external-ssd', /external (ssd|drive|hdd)|portable ssd|ssd externe|disque (dur )?externe/],
  ['wifi-adapter', /wi-?fi (adapter|dongle|card)|adaptateur wi-?fi|bluetooth adapter/],
  ['webcam', /webcam|cam[ée]ra web/],
  ['headset', /headset|headphones?|casque|earbuds|[ée]couteurs/],
  ['speakers', /speakers?|enceintes?|haut-parleurs?|soundbar/],
  ['keyboard', /keyboard|clavier/],
  ['mouse', /\bmouse\b|\bmice\b|souris/],
  ['cable', /\bcables?\b|c[âa]bles?|hdmi|displayport/],
  ['monitor', /\bmonitor\b|[ée]cran|moniteur/],
  ['gaming-pc', /gaming (pc|desktop|tower)|pc gamer/],
  ['desktop', /\bdesktop\b|pc de bureau|all-in-one|\btower\b/],
  ['laptop', /\blaptop\b|notebook|ordinateur portable|ultrabook/],
];

/** What to suggest next to each kind, best first. */
const COMPLEMENTS: Record<Kind, Kind[]> = {
  'gaming-pc': ['monitor', 'mouse', 'keyboard', 'headset', 'mousepad', 'keyboard-mouse', 'speakers', 'cable', 'wifi-adapter', 'webcam'],
  desktop: ['monitor', 'keyboard-mouse', 'keyboard', 'mouse', 'speakers', 'headset', 'webcam', 'wifi-adapter', 'cable'],
  laptop: ['laptop-bag', 'mouse', 'laptop-stand', 'usb-hub', 'external-ssd', 'cooling-pad', 'headset', 'keyboard', 'cable'],
  monitor: ['monitor-arm', 'cable', 'light-bar', 'webcam', 'speakers', 'usb-hub'],
  mousepad: ['mouse', 'keyboard', 'headset'],
  'keyboard-mouse': ['mousepad', 'headset', 'speakers', 'webcam'],
  keyboard: ['mouse', 'mousepad', 'headset'],
  mouse: ['mousepad', 'keyboard', 'headset'],
  headset: ['mouse', 'keyboard', 'mousepad', 'webcam'],
  speakers: ['webcam', 'keyboard-mouse', 'cable'],
  webcam: ['headset', 'light-bar', 'speakers'],
  'monitor-arm': ['cable', 'light-bar', 'usb-hub'],
  'light-bar': ['monitor-arm', 'cable', 'webcam'],
  'laptop-bag': ['mouse', 'usb-hub', 'external-ssd', 'laptop-stand'],
  'laptop-stand': ['usb-hub', 'mouse', 'keyboard', 'cable', 'laptop-bag'],
  'cooling-pad': ['laptop-stand', 'mouse', 'usb-hub', 'laptop-bag'],
  'usb-hub': ['cable', 'external-ssd', 'laptop-stand', 'mouse'],
  'external-ssd': ['usb-hub', 'cable', 'laptop-bag'],
  'wifi-adapter': ['usb-hub', 'cable'],
  cable: ['usb-hub', 'monitor-arm', 'light-bar'],
  accessory: [],
};

/** Computers and monitors may also show accessories that don't match any known kind. */
const FALLBACK_TO_ACCESSORIES: Kind[] = ['gaming-pc', 'desktop', 'laptop', 'monitor'];

const GAMING = /gaming|gamer|\brgb\b|e-?sport|\brtx\b|radeon|\bfps\b/;
const MAX_PER_KIND = 2;
const DEFAULT_LIMIT = 8;
const CANDIDATE_LIMIT = 200;
const CARD_FIELDS = '-description';

type Classifiable = {
  name?: string;
  tags?: string[];
  specs?: Map<string, string> | Record<string, string>;
  category?: unknown;
};

function categorySlug(category: unknown): string {
  return category && typeof category === 'object' && 'slug' in category
    ? String((category as { slug?: string }).slug || '')
    : '';
}

function profileText(product: Classifiable): string {
  const specs = product.specs instanceof Map ? Object.fromEntries(product.specs) : product.specs || {};
  return [product.name, ...(product.tags || []), specs.Use, specs.Type]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function classifyProduct(product: Classifiable): { kind: Kind; gaming: boolean } {
  const text = profileText(product);
  const gaming = GAMING.test(text);
  const slug = categorySlug(product.category);
  const byCategory = CATEGORY_KINDS[slug];
  if (byCategory) return { kind: byCategory, gaming: gaming || byCategory === 'gaming-pc' };
  const match = KEYWORD_KINDS.find(([, rx]) => rx.test(text));
  if (match) {
    // A plain desktop with gaming hardware is a gaming PC
    const kind = match[0] === 'desktop' && gaming ? 'gaming-pc' : match[0];
    return { kind, gaming };
  }
  return { kind: 'accessory', gaming };
}

/** Regex sources that pre-select candidates in Mongo before exact classification. */
function candidateFilters(kinds: Kind[], categoryIds: mongoose.Types.ObjectId[]) {
  const sources = KEYWORD_KINDS.filter(([kind]) => kinds.includes(kind)).map(([, rx]) => rx.source);
  const or: Record<string, unknown>[] = [];
  if (categoryIds.length) or.push({ category: { $in: categoryIds } });
  if (sources.length) {
    const rx = new RegExp(sources.join('|'), 'i');
    or.push({ name: rx }, { tags: rx }, { 'specs.Use': rx });
  }
  return or;
}

export async function getRecommendations(productId: string, limit = DEFAULT_LIMIT) {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, 'Product not found');
  const product = await Product.findOne({ _id: productId, isActive: true })
    .populate('category', 'slug')
    .lean();
  if (!product) throw new ApiError(404, 'Product not found');

  const { kind } = classifyProduct(product);
  const targets = COMPLEMENTS[kind];
  const allowFallback = FALLBACK_TO_ACCESSORIES.includes(kind);
  if (!targets.length && !allowFallback) return [];

  const activeCategories = await Category.find({ isActive: true }).select('_id slug').lean();
  const targetCategorySlugs = Object.entries(CATEGORY_KINDS)
    .filter(([, kind]) => targets.includes(kind))
    .map(([slug]) => slug);
  if (allowFallback) targetCategorySlugs.push('accessories');
  const categoryIds = activeCategories
    .filter((c) => targetCategorySlugs.includes(c.slug))
    .map((c) => c._id as mongoose.Types.ObjectId);

  const or = candidateFilters(targets, categoryIds);
  if (!or.length) return [];

  const candidates = await Product.find({
    _id: { $ne: product._id },
    isActive: true,
    category: { $in: activeCategories.map((c) => c._id) },
    $or: or,
  })
    .select(CARD_FIELDS)
    .sort({ soldCount: -1, averageRating: -1 })
    .limit(CANDIDATE_LIMIT)
    .populate('category', 'name slug isActive')
    .populate('brand', 'name slug logo')
    .lean();

  return rankRecommendations(product, candidates, limit);
}

/**
 * Orders candidates for `product`: complements in priority order, in stock first,
 * gaming gear next to gaming products, at most MAX_PER_KIND of each kind.
 */
export function rankRecommendations<T extends Classifiable & { _id: unknown; stock: number }>(
  product: Classifiable & { _id: unknown },
  candidates: T[],
  limit = DEFAULT_LIMIT
): T[] {
  const current = classifyProduct(product);
  const targets = COMPLEMENTS[current.kind];
  const allowFallback = FALLBACK_TO_ACCESSORIES.includes(current.kind);
  const seen = new Set([String(product._id)]);

  const scored = candidates
    .map((candidate) => {
      if (seen.has(String(candidate._id))) return null;
      seen.add(String(candidate._id));
      const { kind, gaming } = classifyProduct(candidate);
      const rank = targets.indexOf(kind);
      // Fallback only uses accessories we can't classify — never a known misfit (e.g. a laptop stand for a desktop)
      const isFallback =
        rank === -1 &&
        allowFallback &&
        kind === 'accessory' &&
        categorySlug(candidate.category) === 'accessories';
      if (rank === -1 && !isFallback) return null;
      let score = isFallback ? 0 : (targets.length - rank) * 10;
      if (candidate.stock > 0) score += 1000;
      if (current.gaming && gaming) score += 6;
      if (!current.gaming && gaming) score -= kind === 'monitor' || kind === 'gaming-pc' ? 4 : 2;
      return { candidate, kind: isFallback ? ('accessory' as Kind) : kind, score };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.score - a.score);

  const perKind = new Map<Kind, number>();
  const picked: T[] = [];
  for (const row of scored) {
    const count = perKind.get(row.kind) || 0;
    if (count >= MAX_PER_KIND) continue;
    perKind.set(row.kind, count + 1);
    picked.push(row.candidate);
    if (picked.length >= limit) break;
  }
  return picked;
}
