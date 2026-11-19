// Shop page rebuilt (Nov 2026) in the style of the big Moroccan PC shops, Brynoxa colours:
// path, dark banner (title, description, search, header product), category cards, filters on the
// left, grid or list of products on the right.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');

test('order: banner, category cards, filters + toolbar + products, pagination', () => {
  const shop = src('pages/store/Shop.tsx');
  const marks = ['<ShopBanner', '<ShopCategoryStrip', 'aria-label={t(\'shop.filters\')} className="hidden lg:block"', '<SortSelect', '<HomeShopCard', '<Pagination'];
  const pos = marks.map((m) => shop.indexOf(m));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), marks.map((m, i) => m + ': ' + pos[i]).join('\n'));
  assert.ok(src('components/shop/ShopBanner.tsx').includes('<h1 id="shop-heading"'), 'one main title, in the banner');
});

test('everything stays in the address; filter clicks keep the scroll; deals and stock filters work', () => {
  const shop = src('pages/store/Shop.tsx');
  assert.ok(shop.includes("onSale: next.onSale ? 'true' : undefined,"));
  assert.ok(shop.includes("inStock: next.inStock ? 'true' : undefined,"));
  assert.ok(shop.includes("setParams(next, 'page' in patch ? undefined : { state: { keepScroll: true } })"));
  assert.ok(shop.includes("noIndex: Boolean(filters.q)"), 'search pages stay out of Google');
});

test('path: Home › Shop › main category › sub-category', () => {
  const shop = src('pages/store/Shop.tsx');
  assert.ok(shop.includes("const crumbs: { label: string; to?: string }[] = [{ label: t('common.home'), to: '/' }]"));
  assert.ok(shop.includes('to: `/category/${activeMain.slug}`'));
  const banner = src('components/shop/ShopBanner.tsx');
  assert.ok(banner.includes('aria-current="page"'));
});

test('list view: specs, price, stock, cash on delivery, delivery (free when the cart rule says so), Add to cart', () => {
  const c = src('components/shop/ShopListCard.tsx');
  for (const k of ['keySpecs(product, locale, 5)', '<StockLine', "t('home.trustCodTitle')", "free ? t('home.freeDelivery') : t('home.trustDeliveryTitle')", "t('common.addToCart')", 'useAddToCart(product)']) assert.ok(c.includes(k), k);
});

test('top of the shop: the path and the search bar only (no banner card, no header product); the title stays for Google', () => {
  const b = src('components/shop/ShopBanner.tsx');
  assert.ok(b.includes('role="search"'));
  assert.ok(b.includes('<h1 id="shop-heading" className="sr-only">'), 'title for Google and screen readers');
  assert.doesNotMatch(b, /useHeroProduct|BannerProduct|<img/, 'no photo, no product card');
  const shop = src('pages/store/Shop.tsx');
  assert.doesNotMatch(shop, /allPicks|onePerCategory|shop-all-hero/, 'no request for a banner product any more');
});

test('categories under the search: round photos with the name under them, like the home page', () => {
  const s = src('components/shop/ShopCategoryStrip.tsx');
  assert.ok(s.includes("'relative grid size-16 place-items-center overflow-hidden rounded-full border-2"));
  assert.ok(s.includes('loading="eager"') && s.includes('disabled={c.empty}'));
});

test('texts in the three languages', () => {
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['breadcrumb', 'readMore', 'readLess', 'resetFilters', 'apply', 'availability', 'showMore', 'showLess', 'viewGrid', 'viewList', 'seeDetails']) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});

test('the old filter panel is gone', () => {
  assert.ok(!fs.existsSync(path.join(root, 'frontend/src/components/product/FilterSidebar.tsx')));
});

test('category pages use the shop: their own address and Google title, another category opens its page, Reset keeps the category', () => {
  const shop = src('pages/store/Shop.tsx');
  assert.ok(shop.includes('export function Shop({ categorySlug }: { categorySlug?: string } = {})'));
  assert.ok(shop.includes('category: categorySlug || params.get(\'category\') || undefined,'));
  assert.ok(shop.includes("navigate(`${patch.category ? `/category/${patch.category}` : '/shop'}"));
  assert.ok(shop.includes("title: t('meta.categoryTitle', { name: activeCategoryName }),"));
  assert.ok(shop.includes('to: `/category/${activeMain.slug}`'), 'the path links the main category page');
  const page = src('pages/store/CategoryPage.tsx');
  assert.ok(page.includes("t('shop.categoryMissing')"), 'a wrong address still says "Category not found"');
});

test('products per page: 12 (default, as preload asks), 24 or 48; quick choices; sticky toolbar on phones; brand logos', () => {
  const shop = src('pages/store/Shop.tsx');
  assert.ok(shop.includes('export const PAGE_SIZES = [12, 24, 48] as const'));
  assert.ok(shop.includes("limit: PAGE_SIZES.find((n) => String(n) === params.get('limit')) ?? 12,"), 'any other value falls back to 12');
  assert.ok(shop.includes("update({ limit: e.target.value === '12' ? undefined : e.target.value })"));
  assert.ok(shop.includes('...BUDGETS.map((b) => {'), 'the home budget bands as quick choices');
  assert.ok(shop.includes('sticky top-[calc(var(--nav-height)+0.25rem)] z-20') && shop.includes('lg:static'));
  assert.ok(src('components/shop/ShopFilters.tsx').includes('sizedImageUrl(b.logo, 80)'));
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['perPage', 'quickFilters']) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});

test('category photos show at once; sub-categories are visible on the shop, in its filters and on the home page', async () => {
  const strip = src('components/shop/ShopCategoryStrip.tsx');
  assert.ok(strip.includes('loading="eager"'), 'the cards are at the top: their photos load at once');
  assert.ok(strip.indexOf('<SiteIcon name={categoryIcon(c.slug, c.name)} size={20} />') < strip.indexOf('src={thumb}'), 'the icon shows under the photo while it loads');
  assert.ok(src('pages/store/Shop.tsx').includes('withSubCategories(mainList, categoryList)'), '"All": main categories and their sub-categories');
  assert.ok(src('components/shop/ShopFilters.tsx').includes('{subs.length || later.length ? ('), 'filters: sub-categories always listed');
  const home = src('pages/store/Home.tsx');
  assert.ok(home.includes('const homeWithSubs = withSubCategories(homeCategories, shownCategories)'));
  assert.ok(home.includes('categories={homeWithSubs}') && home.includes('<HomeIntro categories={homeWithSubs}'));
  assert.ok(src('components/home/HomeHero.tsx').includes('const sub = isSubCategory(c, categories)'), 'menu: sub-categories indented');
  const { pathToFileURL } = await import('node:url');
  const tree = await import(pathToFileURL(path.join(root, 'frontend/src/lib/categoryTree.ts')).href);
  const cats = [{ _id: 'a', slug: 'accessories' }, { _id: 'l', slug: 'laptops' }, { _id: 'm', slug: 'mice', parent: 'a' }, { _id: 'h', slug: 'headphones', parent: 'a' }] as never[];
  assert.deepEqual(tree.withSubCategories(tree.mainCategories(cats), cats).map((c: { slug: string }) => c.slug), ['accessories', 'mice', 'headphones', 'laptops']);
  assert.equal(tree.isSubCategory(cats[2], cats), true);
  assert.equal(tree.isSubCategory(cats[0], cats), false);
});

test('empty sub-categories: listed as "Coming soon" on the shop (not clickable); the normal list still hides them', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  require('./_helpers.cjs').setTestEnv();
  const dist = (p: string) => path.join(root, 'backend/dist', p);
  const { Category } = require(dist('models/Category.js'));
  const { Product } = require(dist('models/Product.js'));
  const catalog = require(dist('services/catalog.service.js'));
  const doc = (o: Record<string, unknown>) => ({ ...o, toObject: () => ({ ...o }) });
  const cats = [
    { _id: 'm1', slug: 'components', isActive: true, parent: null },
    { _id: 's1', slug: 'ram', isActive: true, parent: 'm1' },
    { _id: 'm2', slug: 'accessories', isActive: true, parent: null },
    { _id: 's2', slug: 'mice', isActive: true, parent: 'm2' },
    { _id: 'm3', slug: 'cameras', isActive: true, parent: null },
    { _id: 's3', slug: 'webcams', isActive: true, parent: 'm3' },
  ];
  const orig = { find: Category.find, agg: Product.aggregate };
  Category.find = (q: Record<string, unknown>) => {
    const chain = { sort: () => chain, populate: async () => cats.map((c) => doc({ ...c, parent: c.parent ? { _id: c.parent } : null })), select: () => ({ lean: async () => cats }) };
    void q;
    return chain;
  };
  // Products in Components (the main one) and in Mice; nothing in Cameras / Webcams / RAM
  Product.aggregate = async () => [{ _id: 'm1' }, { _id: 's2' }];
  try {
    const plain = (await catalog.listCategories(true)).map((c: { slug: string }) => c.slug);
    assert.deepEqual(plain.sort(), ['accessories', 'components', 'mice']);
    const soon = await catalog.listCategories(true, { emptySubs: true });
    const bySlug = Object.fromEntries(soon.map((c: { slug: string; empty?: boolean }) => [c.slug, Boolean(c.empty)]));
    assert.equal(bySlug.ram, true, 'RAM: empty sub-category of a shown category → "Coming soon"');
    assert.equal(bySlug.components, false);
    assert.equal(bySlug.mice, false);
    assert.ok(!('webcams' in bySlug) && !('cameras' in bySlug), 'nothing under a category that is not shown');
  } finally {
    Category.find = orig.find;
    Product.aggregate = orig.agg;
  }
  assert.ok(fs.readFileSync(path.join(root, 'api/v1/categories.js'), 'utf8').includes("catalog.listCategories(activeOnly, { emptySubs: query.emptySubs === 'true' })"), 'the live site too');
  const strip = src('components/shop/ShopCategoryStrip.tsx');
  assert.ok(strip.includes('disabled={c.empty}') && strip.includes("t('shop.comingSoon')"));
  for (const l of ['en', 'fr', 'ar']) assert.ok(src(`i18n/${l}.ts`).includes("    comingSoon: '"), l);
});

test('photos sit well on the dark page: shop banner photo on the right, softened; category card photo not squeezed', () => {
  const blocks = src('components/home/HomeBlocks.tsx');
  assert.ok(blocks.includes('<span className="relative block aspect-[4/3] overflow-hidden">'), 'the category photo in its own landscape frame, the text under it');
});

test('phones: compact banner, cards and texts (computers keep their sizes)', () => {
  const slider = src('components/home/HomeHeroSlider.tsx');
  assert.ok(slider.includes("'grid h-full grid-cols-[38%_minmax(0,1fr)] items-center gap-3 p-3 [grid-area:1/1] sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"), 'deals banner: photo beside the text on phones');
  assert.ok(slider.includes('text-[15px] font-bold leading-tight tracking-tight sm:mt-4 sm:text-3xl'), 'banner title: small on phones, as before on computers');
  const card = src('components/home/HomeShopCard.tsx');
  assert.ok(card.includes("'relative aspect-[5/4] overflow-hidden sm:aspect-square'"), 'card photo: shorter on phones');
  assert.ok(card.includes('text-[11px] font-bold uppercase leading-[1.25] tracking-tight text-[var(--fg)] sm:text-sm'));
  assert.ok(src('components/home/HomeTrustBar.tsx').includes('hidden text-[11px] leading-snug text-[var(--fg-muted)] sm:block'), 'promises: titles only on phones');
  const grid = src('components/home/HomeShelf.tsx');
  assert.ok(grid.includes('-mx-2.5 flex snap-x snap-mandatory') && grid.includes('sm:grid sm:grid-cols-3'), 'Our selection: a row you swipe on phones, a grid from tablets up');
  assert.ok(grid.includes('w-[44%] shrink-0 snap-start sm:w-auto'), 'a bit of the third card shows, so the row clearly moves');
  const list = src('components/shop/ShopListCard.tsx');
  assert.ok(list.includes('grid-cols-[6.5rem_minmax(0,1fr)]'), 'list view: photo beside the text on phones');
  assert.ok(list.includes('col-start-2 row-span-2 row-start-1'), 'list view: Add to cart beside the price on phones');
});

test('Admin → Products follows the new site: names and order of the home page, Top picks wording, categories with their sub-categories', () => {
  const placements = src('hooks/useStorefrontPlacements.ts');
  for (const k of ["'Home · Deals banner'", "'Home · Top picks (first)'", "'Home · Top picks (then)'"]) assert.ok(placements.includes(k), k);
  const list = src('pages/admin/Products.tsx');
  assert.ok(list.includes("deals: 'Deals banner'") && !list.includes("shopHeader: 'Shop header'"));
  assert.ok(list.includes('withSubCategories(mainCategories('), 'category filter: main categories then their sub-categories');
  const form = src('pages/admin/ProductForm.tsx');
  assert.ok(form.includes('options={withSubCategories(mainCategories(categoryList), categoryList).map('));
  assert.ok(form.includes('Tip: put it in a sub-category so customers find it there too'), 'one click to move a product into a sub-category');
  assert.ok(form.includes('Home · Top picks (first)') && form.includes('Home · Top picks (then)'));
  const dialog = src('components/admin/ProductPlacementDialog.tsx');
  assert.ok(dialog.includes('<Row title="Deals banner"') && dialog.includes('<Row title="Top picks (first)"'));
});
