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
  assert.ok(shop.includes('to: `/shop?category=${activeMain.slug}`'));
  const banner = src('components/shop/ShopBanner.tsx');
  assert.ok(banner.includes('aria-current="page"'));
});

test('list view: specs, price, stock, cash on delivery, delivery (free when the cart rule says so), Add to cart', () => {
  const c = src('components/shop/ShopListCard.tsx');
  for (const k of ['keySpecs(product, locale, 5)', '<StockLine', "t('home.trustCodTitle')", "free ? t('home.freeDelivery') : t('home.trustDeliveryTitle')", "t('common.addToCart')", 'useAddToCart(product)']) assert.ok(c.includes(k), k);
});

test('banner product: the one chosen in admin, else one per category in turn; stops on hover and for less motion', () => {
  const b = src('components/shop/ShopBanner.tsx');
  assert.ok(b.includes('const products = hero.product ? [hero.product] : (rotate ?? [])'));
  assert.ok(b.includes("prefers-reduced-motion: reduce") && b.includes('onMouseEnter={() => setPaused(true)}'));
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
