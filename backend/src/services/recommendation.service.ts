import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';

/**
 * "Complete your setup" recommendations.
 *
 * Every product gets a kind (laptop, mouse, power supply, …) from, in order: its category, the
 * product type chosen in admin (`specTemplate`), then keywords in its name / tags / specs.
 * COMPLEMENTS lists, per kind, the kinds that complete it, best first — so a laptop shows a bag,
 * a mouse, a hub… and never another laptop. Candidates are then checked for compatibility
 * (USB-C, display ports, DDR generation, CPU socket, gaming), boosted when customers bought them
 * together, featured or best sellers, and limited to active, in-stock products.
 */

export type Kind =
  | 'gaming-pc'
  | 'desktop'
  | 'laptop'
  | 'monitor'
  | 'gpu'
  | 'cpu'
  | 'ram'
  | 'motherboard'
  | 'psu'
  | 'pc-case'
  | 'pc-cooling'
  | 'storage'
  | 'external-ssd'
  | 'enclosure'
  | 'm2-heatsink'
  | 'sata-cable'
  | 'mousepad'
  | 'wrist-rest'
  | 'keyboard-mouse'
  | 'keyboard'
  | 'mouse'
  | 'headset'
  | 'microphone'
  | 'usb-audio'
  | 'speakers'
  | 'webcam'
  | 'monitor-arm'
  | 'light-bar'
  | 'laptop-bag'
  | 'laptop-stand'
  | 'cooling-pad'
  | 'usb-hub'
  | 'display-cable'
  | 'ethernet-cable'
  | 'cable'
  | 'wifi-adapter'
  | 'switch'
  | 'access-point'
  | 'router'
  | 'ups'
  | 'rgb'
  | 'printer'
  | 'accessory';

/** Category slugs that decide the kind on their own. */
const CATEGORY_KINDS: Record<string, Kind> = {
  'gaming-pcs': 'gaming-pc',
  laptops: 'laptop',
  monitors: 'monitor',
};

/** Keyword rules, most specific first (mouse pad before mouse, hub before cable…). */
const KEYWORD_KINDS: [Kind, RegExp][] = [
  ['mousepad', /mouse ?pad|desk ?mat|tapis de souris/],
  ['wrist-rest', /wrist ?rest|repose[- ]poignets?/],
  ['keyboard-mouse', /combo|keyboard (and|&|\+) mouse|clavier (et|&|\+) souris/],
  ['monitor-arm', /monitor (arm|stand|mount)|desk (stand|mount)|bras (d'|d’|de )?[ée]cran|support (d'|d’)?[ée]cran|vesa/],
  ['light-bar', /light ?bar|screen ?bar|lampe (d'|d’)?[ée]cran/],
  ['laptop-bag', /laptop (bag|sleeve|backpack)|backpack|sleeve|sacoche|sac (à|a) dos/],
  ['laptop-stand', /laptop stand|support (pc |ordinateur )?portable|\bstand\b/],
  ['cooling-pad', /cooling ?pad|cooler pad|refroidisseur (pc )?portable/],
  ['m2-heatsink', /m\.?2 (heat ?sink|cooler)|dissipateur m\.?2/],
  ['enclosure', /enclosure|bo[iî]tier (externe|ssd|hdd|disque)|\bcaddy\b/],
  ['sata-cable', /sata (cable|data)|c[âa]ble sata/],
  ['external-ssd', /external (ssd|drive|hdd)|portable ssd|ssd externe|disque (dur )?externe/],
  ['usb-audio', /usb (audio|sound)|sound ?card|carte son|dac\b/],
  ['microphone', /microphone|\bmic\b/],
  ['usb-hub', /\bhub\b|\bdock\b|docking|chargedock|station d'accueil|usb-?c adapter|adaptateur usb/],
  ['wifi-adapter', /wi-?fi (adapter|dongle|card)|adaptateur wi-?fi|bluetooth adapter/],
  ['access-point', /access ?point|point d'acc[eè]s|mesh/],
  ['switch', /(network|ethernet|gigabit|poe) switch|\d+[- ]port switch|switch \d+ ports?|commutateur/],
  ['router', /router|routeur/],
  ['ups', /\bups\b|onduleur|uninterruptible/],
  ['psu', /power supply|\bpsu\b|alimentation|\b\d{3,4} ?w\b.*(80\+|gold|bronze|platinum)/],
  ['pc-case', /pc case|computer case|\bchassis\b|bo[iî]tier pc|mid[- ]tower|full[- ]tower/],
  ['pc-cooling', /cpu cooler|aio\b|liquid cool|watercooling|case fan|ventilateur|thermal paste|p[âa]te thermique/],
  ['rgb', /\brgb\b (strip|fan|kit|light)|led strip|ruban led/],
  ['webcam', /webcam|cam[ée]ra web/],
  ['headset', /headset|headphones?|casque|earbuds|[ée]couteurs/],
  ['speakers', /speakers?|enceintes?|haut-parleurs?|soundbar/],
  ['keyboard', /keyboard|clavier/],
  ['mouse', /\bmouse\b|\bmice\b|souris/],
  ['display-cable', /hdmi|displayport|\bdp cable|c[âa]ble (vid[ée]o|[ée]cran)/],
  ['ethernet-cable', /ethernet|rj-?45|\bcat ?[5-8]e?\b|c[âa]ble r[ée]seau/],
  ['cable', /\bcables?\b|c[âa]bles?/],
  ['gpu', /graphics card|\bgpu\b|carte graphique|\brtx ?\d{4}\b|\bgtx ?\d{3,4}\b|radeon rx/],
  ['motherboard', /motherboard|carte m[èe]re|\bb[67]\d0\b|\bz[67]\d0\b|\bx[67]\d0\b/],
  ['ram', /\bddr[345]\b.*\b(ram|memory|m[ée]moire)\b|\bram\b (kit|stick)|barrette/],
  ['storage', /\bnvme\b|\bssd\b|\bhdd\b|hard drive|disque dur/],
  ['cpu', /processor|processeur|\bcpu\b|ryzen [3579] \d{4}|core i[3579]-\d{4,5}/],
  ['printer', /printer|imprimante|scanner/],
  ['monitor', /\bmonitor\b|[ée]cran|moniteur/],
  ['gaming-pc', /gaming (pc|desktop|tower)|pc gamer/],
  ['desktop', /\bdesktop\b|pc de bureau|all-in-one|\btower\b/],
  ['laptop', /\blaptop\b|notebook|ordinateur portable|ultrabook/],
];

/** The product type picked in admin (Specifications → Product type) → kind. */
const TEMPLATE_KINDS: Record<string, Kind> = {
  laptop: 'laptop',
  desktop: 'desktop',
  monitor: 'monitor',
  gpu: 'gpu',
  cpu: 'cpu',
  ram: 'ram',
  storage: 'storage',
  motherboard: 'motherboard',
  keyboard: 'keyboard',
  mouse: 'mouse',
  audio: 'headset',
  printer: 'printer',
  networking: 'router',
};
/** Broad product types: the keywords say more precisely what it is (e.g. audio → speakers). */
const REFINE_TEMPLATES = new Set(['audio', 'networking', 'storage', 'accessory', 'keyboard']);

/** What to suggest next to each kind, best first. Main products (another laptop…) are never listed. */
const COMPLEMENTS: Record<Kind, Kind[]> = {
  laptop: ['mouse', 'laptop-bag', 'usb-hub', 'keyboard', 'headset', 'cooling-pad', 'external-ssd', 'webcam', 'mousepad', 'laptop-stand', 'keyboard-mouse', 'cable'],
  'gaming-pc': ['monitor', 'keyboard', 'mouse', 'headset', 'mousepad', 'keyboard-mouse', 'speakers', 'webcam', 'ups', 'rgb', 'display-cable', 'wifi-adapter', 'cable'],
  desktop: ['monitor', 'keyboard-mouse', 'keyboard', 'mouse', 'headset', 'speakers', 'mousepad', 'webcam', 'ups', 'wifi-adapter', 'display-cable', 'rgb', 'cable'],
  monitor: ['display-cable', 'monitor-arm', 'keyboard', 'mouse', 'keyboard-mouse', 'speakers', 'headset', 'light-bar', 'webcam'],
  gpu: ['psu', 'display-cable', 'pc-case', 'pc-cooling', 'monitor'],
  cpu: ['motherboard', 'pc-cooling', 'ram', 'storage', 'psu'],
  ram: ['motherboard', 'cpu', 'storage'],
  motherboard: ['cpu', 'ram', 'storage', 'psu', 'pc-case', 'pc-cooling'],
  psu: ['pc-case', 'gpu', 'pc-cooling', 'ups'],
  'pc-case': ['psu', 'pc-cooling', 'rgb', 'motherboard'],
  'pc-cooling': ['pc-case', 'rgb', 'cpu'],
  storage: ['enclosure', 'usb-hub', 'sata-cable', 'm2-heatsink', 'external-ssd'],
  'external-ssd': ['usb-hub', 'cable', 'laptop-bag'],
  enclosure: ['storage', 'usb-hub', 'cable'],
  'm2-heatsink': ['storage', 'pc-cooling'],
  'sata-cable': ['storage', 'enclosure'],
  keyboard: ['mouse', 'mousepad', 'wrist-rest', 'headset'],
  mouse: ['mousepad', 'keyboard', 'headset', 'wrist-rest'],
  'keyboard-mouse': ['mousepad', 'wrist-rest', 'headset', 'speakers', 'webcam'],
  mousepad: ['mouse', 'keyboard', 'wrist-rest', 'headset'],
  'wrist-rest': ['keyboard', 'mouse', 'mousepad'],
  headset: ['microphone', 'speakers', 'usb-audio', 'mouse', 'mousepad'],
  microphone: ['headset', 'usb-audio', 'webcam', 'speakers'],
  'usb-audio': ['headset', 'microphone', 'speakers'],
  speakers: ['headset', 'microphone', 'usb-audio', 'cable'],
  webcam: ['microphone', 'headset', 'light-bar', 'speakers'],
  'monitor-arm': ['display-cable', 'light-bar', 'usb-hub'],
  'light-bar': ['monitor-arm', 'webcam', 'display-cable'],
  'laptop-bag': ['mouse', 'usb-hub', 'external-ssd', 'laptop-stand'],
  'laptop-stand': ['usb-hub', 'keyboard', 'mouse', 'keyboard-mouse', 'laptop-bag'],
  'cooling-pad': ['laptop-stand', 'mouse', 'usb-hub', 'laptop-bag'],
  'usb-hub': ['display-cable', 'external-ssd', 'cable', 'laptop-stand', 'mouse'],
  'display-cable': ['monitor-arm', 'usb-hub', 'light-bar'],
  'ethernet-cable': ['switch', 'wifi-adapter', 'access-point', 'router'],
  cable: ['usb-hub', 'display-cable', 'monitor-arm'],
  'wifi-adapter': ['ethernet-cable', 'access-point', 'router', 'usb-hub'],
  switch: ['ethernet-cable', 'access-point', 'router', 'ups'],
  'access-point': ['ethernet-cable', 'switch', 'router', 'wifi-adapter'],
  router: ['ethernet-cable', 'switch', 'access-point', 'wifi-adapter', 'ups'],
  ups: ['switch', 'router'],
  rgb: ['pc-case', 'pc-cooling', 'keyboard', 'mousepad'],
  printer: ['cable', 'ups'],
  accessory: [],
};

/** Computers and monitors may also show accessories that don't match any known kind. */
const FALLBACK_TO_ACCESSORIES: Kind[] = ['gaming-pc', 'desktop', 'laptop', 'monitor'];

const GAMING = /gaming|gamer|\brgb\b|e-?sport|\brtx\b|radeon|\bfps\b/;
const USB_C = /usb[- ]?c|type[- ]?c|thunderbolt/;
const MAX_PER_KIND = 2;
const DEFAULT_LIMIT = 8;
const CANDIDATE_LIMIT = 250;
const CARD_FIELDS = '-description';
const CACHE_MS = 5 * 60_000;

type Classifiable = {
  name?: string;
  tags?: string[];
  specs?: Map<string, string> | Record<string, string>;
  specTemplate?: string;
  category?: unknown;
};

function categorySlug(category: unknown): string {
  return category && typeof category === 'object' && 'slug' in category
    ? String((category as { slug?: string }).slug || '')
    : '';
}

function specValues(product: Classifiable): Record<string, string> {
  return product.specs instanceof Map ? Object.fromEntries(product.specs) : product.specs || {};
}

/** Name, tags and every spec value, lowercased: what we search for keywords and compatibility. */
function profileText(product: Classifiable): string {
  return [product.name, ...(product.tags || []), ...Object.values(specValues(product))]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Name and tags only: what the product *is* (specs mention other things, e.g. "HDMI" ports). */
function identityText(product: Classifiable): string {
  const specs = specValues(product);
  return [product.name, ...(product.tags || []), specs.Use, specs.Type, specs.use_case].filter(Boolean).join(' ').toLowerCase();
}

export function classifyProduct(product: Classifiable): { kind: Kind; gaming: boolean } {
  const gaming = GAMING.test(profileText(product));
  const byCategory = CATEGORY_KINDS[categorySlug(product.category)];
  if (byCategory) return { kind: byCategory, gaming: gaming || byCategory === 'gaming-pc' };

  const identity = identityText(product);
  const keyword = KEYWORD_KINDS.find(([, rx]) => rx.test(identity))?.[0];
  const template = product.specTemplate ? TEMPLATE_KINDS[product.specTemplate] : undefined;

  let kind: Kind = 'accessory';
  if (template && !REFINE_TEMPLATES.has(product.specTemplate!)) kind = template;
  else if (keyword) kind = keyword;
  else if (template) kind = template;
  // External drives are typed as "Storage" in admin but go with laptops, not motherboards
  if (kind === 'storage' && keyword === 'external-ssd') kind = 'external-ssd';
  // A plain desktop with gaming hardware is a gaming PC
  if (kind === 'desktop' && gaming) kind = 'gaming-pc';
  return { kind, gaming };
}

/** Readable reason shown on the card ("Mouse", "USB-C hub"…), translated in the storefront. */
export function setupKindOf(product: Classifiable): Kind {
  return classifyProduct(product).kind;
}

/* ---------- Compatibility ---------- */

const DDR = /\bddr([345])\b/g;
const SOCKET = /\b(lga ?\d{4}|am[45]|fm2\+?|tr4|str5)\b/g;

function tokens(text: string, rx: RegExp) {
  return new Set([...text.matchAll(rx)].map((m) => m[0].replace(/\s+/g, '')));
}

/**
 * false = clearly incompatible (never shown); otherwise a small score bonus for a good fit.
 */
function compatibility(current: { kind: Kind; text: string }, candidate: { kind: Kind; text: string }): number | false {
  const pair = new Set([current.kind, candidate.kind]);
  // RAM generation must match between RAM / motherboard / CPU
  if (['ram', 'motherboard', 'cpu'].includes(current.kind) && ['ram', 'motherboard', 'cpu'].includes(candidate.kind)) {
    const a = tokens(current.text, DDR);
    const b = tokens(candidate.text, DDR);
    if (a.size && b.size && ![...a].some((x) => b.has(x))) return false;
  }
  // CPU socket must match between CPU / motherboard / CPU cooler
  if ((pair.has('cpu') || pair.has('motherboard')) && [...pair].every((k) => ['cpu', 'motherboard', 'pc-cooling'].includes(k))) {
    const a = tokens(current.text, SOCKET);
    const b = tokens(candidate.text, SOCKET);
    if (a.size && b.size && ![...a].some((x) => b.has(x))) return false;
  }

  let bonus = 0;
  // USB-C laptops: USB-C hubs, drives and cables first; a laptop without USB-C skips USB-C-only hubs
  if (['laptop', 'desktop', 'gaming-pc'].includes(current.kind) && ['usb-hub', 'external-ssd', 'cable'].includes(candidate.kind)) {
    const hostUsbC = USB_C.test(current.text);
    const accessoryUsbC = USB_C.test(candidate.text);
    if (hostUsbC && accessoryUsbC) bonus += 8;
    if (!hostUsbC && accessoryUsbC && candidate.kind === 'usb-hub' && current.kind === 'laptop' && /usb-a|usb 3|usb3/.test(current.text)) bonus -= 6;
  }
  // Display cables that fit the screen / GPU / PC ports
  if (candidate.kind === 'display-cable') {
    if (/hdmi/.test(current.text) && /hdmi/.test(candidate.text)) bonus += 5;
    if (/displayport|\bdp\b/.test(current.text) && /displayport|\bdp\b/.test(candidate.text)) bonus += 5;
  }
  return bonus;
}

/* ---------- Bought together ---------- */

const pairedCache = new Map<string, { at: number; counts: Map<string, number> }>();

/** How often other products were in the same (non-cancelled) orders as this one, recent orders first. */
async function boughtTogether(productId: string) {
  const hit = pairedCache.get(productId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.counts;
  const counts = new Map<string, number>();
  try {
    const orders = await Order.find({
      'items.product': new mongoose.Types.ObjectId(productId),
      orderStatus: { $nin: ['cancelled'] },
    })
      .select('items.product')
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
    for (const order of orders) {
      const ids = new Set((order.items || []).map((i) => String(i.product)));
      ids.delete(productId);
      for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
    }
  } catch (error) {
    console.error('Bought-together lookup failed', error);
  }
  pairedCache.set(productId, { at: Date.now(), counts });
  return counts;
}

/* ---------- Recommendations ---------- */

type Recommended = Record<string, unknown> & { _id: unknown; setupKind?: Kind };
const resultCache = new Map<string, { at: number; items: Recommended[] }>();

export async function getRecommendations(productId: string, limit = DEFAULT_LIMIT) {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, 'Product not found');
  const product = await Product.findOne({ _id: productId, isActive: true })
    .populate('category', 'slug')
    .lean();
  if (!product) throw new ApiError(404, 'Product not found');

  // Same product, same edit: reuse the last answer for a few minutes
  const cacheKey = `${productId}:${product.updatedAt ? new Date(product.updatedAt).getTime() : 0}:${limit}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.items;

  const activeCategories = await Category.find({ isActive: true }).select('_id slug').lean();
  const activeCategoryIds = activeCategories.map((c) => c._id);

  // Staff picks first, in the order chosen in the admin product form
  const disabledPicks = new Set((product.recommendedDisabled || []).map(String));
  const pickedIds = (product.recommended || []).map(String).filter((id) => !disabledPicks.has(id));
  const pickedDocs = pickedIds.length
    ? await Product.find({
        _id: { $in: pickedIds, $ne: product._id },
        isActive: true,
        category: { $in: activeCategoryIds },
      })
        .select(CARD_FIELDS)
        .populate('category', 'name slug isActive')
        .populate('brand', 'name slug logo')
        .lean()
    : [];
  const picks = pickedIds
    .map((id) => pickedDocs.find((doc) => String(doc._id) === id))
    .filter((doc): doc is NonNullable<typeof doc> => Boolean(doc))
    .map((doc) => ({ ...doc, setupKind: setupKindOf(doc) }));

  let items: Recommended[];
  // All picks are always shown; automatic ones only fill the remaining spots
  if (product.recommendedOnly || picks.length >= limit) {
    items = picks as Recommended[];
  } else {
    const automatic = await automaticRecommendations(product, activeCategories, limit + picks.length, (product.recommendedHidden || []).map(String));
    const pickedSet = new Set(picks.map((doc) => String(doc._id)));
    items = [...picks, ...automatic.filter((doc) => !pickedSet.has(String(doc._id)))].slice(0, limit) as Recommended[];
  }

  if (resultCache.size > 500) resultCache.clear();
  resultCache.set(cacheKey, { at: Date.now(), items });
  return items;
}

async function automaticRecommendations(
  product: Classifiable & { _id: unknown },
  activeCategories: { _id: unknown; slug: string }[],
  limit: number,
  hidden: string[] = []
) {
  const { kind } = classifyProduct(product);
  const targets = COMPLEMENTS[kind];
  const allowFallback = FALLBACK_TO_ACCESSORIES.includes(kind);
  if (!targets.length && !allowFallback) return [];

  const targetCategorySlugs = Object.entries(CATEGORY_KINDS)
    .filter(([, k]) => targets.includes(k))
    .map(([slug]) => slug);
  if (allowFallback) targetCategorySlugs.push('accessories');
  const categoryIds = activeCategories
    .filter((c) => targetCategorySlugs.includes(c.slug))
    .map((c) => c._id as mongoose.Types.ObjectId);
  const targetTemplates = Object.entries(TEMPLATE_KINDS)
    .filter(([, k]) => targets.includes(k))
    .map(([template]) => template);

  // Pre-select in Mongo (category, product type or keywords), then classify exactly
  const sources = KEYWORD_KINDS.filter(([k]) => targets.includes(k)).map(([, rx]) => rx.source);
  const or: Record<string, unknown>[] = [];
  if (categoryIds.length) or.push({ category: { $in: categoryIds } });
  if (targetTemplates.length) or.push({ specTemplate: { $in: [...targetTemplates, 'accessory', 'audio', 'networking', 'storage'] } });
  if (sources.length) {
    const rx = new RegExp(sources.join('|'), 'i');
    or.push({ name: rx }, { tags: rx });
  }
  if (!or.length) return [];

  const [candidates, paired] = await Promise.all([
    Product.find({
      _id: { $nin: [product._id, ...hidden.filter((id) => mongoose.Types.ObjectId.isValid(id)).map((id) => new mongoose.Types.ObjectId(id))] },
      isActive: true,
      stock: { $gt: 0 },
      category: { $in: activeCategories.map((c) => c._id) },
      $or: or,
    })
      .select(CARD_FIELDS)
      .sort({ soldCount: -1, averageRating: -1 })
      .limit(CANDIDATE_LIMIT)
      .populate('category', 'name slug isActive')
      .populate('brand', 'name slug logo')
      .lean(),
    boughtTogether(String(product._id)),
  ]);

  return rankRecommendations(product, candidates, limit, paired);
}

/**
 * Orders candidates for `product`: complements in priority order, compatible ones only, bought
 * together / featured / best sellers / gaming-matched first, at most MAX_PER_KIND of each kind.
 */
export function rankRecommendations<
  T extends Classifiable & { _id: unknown; stock: number; isFeatured?: boolean; soldCount?: number }
>(
  product: Classifiable & { _id: unknown },
  candidates: T[],
  limit = DEFAULT_LIMIT,
  paired: Map<string, number> = new Map()
): (T & { setupKind: Kind })[] {
  const current = classifyProduct(product);
  const currentText = profileText(product);
  const targets = COMPLEMENTS[current.kind];
  const allowFallback = FALLBACK_TO_ACCESSORIES.includes(current.kind);
  const seen = new Set([String(product._id)]);

  const scored = candidates
    .map((candidate) => {
      const id = String(candidate._id);
      if (seen.has(id) || candidate.stock <= 0) return null;
      seen.add(id);
      const { kind, gaming } = classifyProduct(candidate);
      const rank = targets.indexOf(kind);
      // Fallback only uses accessories we can't classify — never a known misfit
      const isFallback =
        rank === -1 && allowFallback && kind === 'accessory' && categorySlug(candidate.category) === 'accessories';
      if (rank === -1 && !isFallback) return null;
      const fit = compatibility({ kind: current.kind, text: currentText }, { kind, text: profileText(candidate) });
      if (fit === false) return null;

      let score = isFallback ? 0 : (targets.length - rank) * 10;
      score += fit;
      score += Math.min(paired.get(id) || 0, 5) * 6; // bought together
      if (candidate.isFeatured) score += 4;
      score += Math.min(Math.log2((candidate.soldCount || 0) + 1), 6); // best sellers
      if (current.gaming && gaming) score += 6;
      if (!current.gaming && gaming) score -= kind === 'monitor' || kind === 'gaming-pc' ? 4 : 2;
      return { candidate, kind: isFallback ? ('accessory' as Kind) : kind, score };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((a, b) => b.score - a.score);

  const perKind = new Map<Kind, number>();
  const picked: (T & { setupKind: Kind })[] = [];
  for (const row of scored) {
    const count = perKind.get(row.kind) || 0;
    if (count >= MAX_PER_KIND) continue;
    perKind.set(row.kind, count + 1);
    picked.push({ ...row.candidate, setupKind: row.kind });
    if (picked.length >= limit) break;
  }
  return picked;
}

/* ---------- Admin preview ---------- */

/**
 * What "Complete your setup" will show for a product being created or edited, from the form's
 * current (unsaved) values: the detected kind, every kind it looks for with how many matching
 * products the shop has, and the automatic suggestions in order.
 */
export async function previewRecommendations(input: {
  productId?: string;
  name?: string;
  category?: string;
  specTemplate?: string;
  tags?: string[];
  specs?: Record<string, string>;
  picks?: string[];
  hidden?: string[];
}) {
  const activeCategories = await Category.find({ isActive: true }).select('_id slug').lean();
  const category = activeCategories.find((c) => String(c._id) === input.category);
  const draft = {
    _id: input.productId && mongoose.Types.ObjectId.isValid(input.productId) ? new mongoose.Types.ObjectId(input.productId) : new mongoose.Types.ObjectId(),
    name: input.name || '',
    tags: input.tags || [],
    specs: input.specs || {},
    specTemplate: input.specTemplate || undefined,
    category: category ? { slug: category.slug } : undefined,
  };
  const { kind } = classifyProduct(draft);
  const wantedKinds = COMPLEMENTS[kind];

  // Rank more than needed so we can tell which wanted kinds the shop has at all
  const exclude = [...(input.picks || []), ...(input.hidden || [])];
  const ranked = await automaticRecommendations(draft, activeCategories, 60, exclude);
  const perKind = new Map<string, number>();
  for (const item of ranked) perKind.set(item.setupKind, (perKind.get(item.setupKind) || 0) + 1);

  const picks = (input.picks || []).length;
  return {
    kind,
    wanted: wantedKinds.map((k) => ({ kind: k, available: perKind.get(k) || 0 })),
    items: ranked.slice(0, Math.max(0, DEFAULT_LIMIT - picks)),
  };
}
