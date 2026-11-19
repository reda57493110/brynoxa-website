// The shop only lists categories with something to buy (in them or in their sub-categories): no
// empty page from the menu, the home tiles, the shop or Google. The Laptops photo has no brand logos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('a category counts when it or one of its sub-categories has a product on sale', async () => {
  const { Product } = require(dist('models/Product.js'));
  const catalog = require(dist('services/catalog.service.js'));
  const orig = Product.aggregate;
  let match;
  Product.aggregate = async (pipeline) => {
    match = pipeline[0].$match;
    return [{ _id: 'ram' }];
  };
  try {
    const all = [
      { _id: 'components' },
      { _id: 'ram', parent: 'components' },
      { _id: 'storage', parent: 'components' },
      { _id: 'desktop' },
    ];
    const set = await catalog.categoriesWithProducts(all);
    assert.deepEqual([...set].sort(), ['components', 'ram'], 'RAM and its main category; empty Storage and Desktop hidden');
    assert.equal(match.isActive, true, 'only products on sale count');
  } finally {
    Product.aggregate = orig;
  }
});

test('the shop list, the sitemap and the home tiles use it', () => {
  const svc = read('backend/src/services/catalog.service.ts');
  assert.ok(svc.includes('const shown = new Set(items.filter((c) => visible.has(String(c._id)) && (withProducts.has(String(c._id)) || core(c))).map((c) => String(c._id)));'));
  assert.ok(svc.includes('if (!opts.emptySubs) return items.filter((c) => shown.has(String(c._id)));'), 'the normal list: only categories with products');
  assert.ok(read('api/sitemap.js').includes('categories.filter((c) => withProducts.has(String(c._id)))'));
  const home = read('frontend/src/pages/store/Home.tsx');
  assert.ok(home.includes('const homeCategories = [...chosen, ...categoryList.filter((c) => !c.parent && !chosen.includes(c))].slice(0, HOME_CATEGORY_MAX)'), 'an empty home category is replaced by another one');
});

test('the Laptops photo: a new file (phones fetch it at once), a real WebP in 3 sizes', () => {
  assert.ok(read('frontend/src/lib/categoryPhoto.ts').includes("laptops: '/categories/laptops-v2.webp',"));
  for (const f of ['laptops-v2.webp', 'laptops-v2-960.webp', 'laptops-v2-480.webp']) {
    const b = fs.readFileSync(path.join(ROOT, 'frontend/public/categories', f));
    assert.equal(b.toString('ascii', 8, 12), 'WEBP', f);
  }
  for (const old of ['laptops.webp', 'laptops-960.webp', 'laptops-480.webp']) assert.ok(!fs.existsSync(path.join(ROOT, 'frontend/public/categories', old)), old);
});

test('the main categories (Laptops, Desktop PCs, Gaming PCs) are always listed, even while empty; their page says so', () => {
  const svc = read('backend/src/services/catalog.service.ts');
  assert.ok(svc.includes("export const ALWAYS_SHOWN_CATEGORIES = ['laptops', 'desktop-pcs', 'gaming-pcs'];"));
  assert.ok(svc.includes('!c.parent && ALWAYS_SHOWN_CATEGORIES.includes(canonicalCategorySlug(c.slug))'), '"desktop-pc" counts as desktop-pcs; main categories only');
  assert.ok(svc.includes('(withProducts.has(String(c._id)) || core(c))'));
  const { canonicalCategorySlug } = require(dist('utils/categorySuggestions.js'));
  assert.equal(canonicalCategorySlug('desktop-pc'), 'desktop-pcs');
  const shop = read('frontend/src/pages/store/Shop.tsx');
  assert.ok(shop.includes("title={t('shop.categoryEmpty')} description={t('shop.categoryEmptyBody')} actionLabel={t('shop.backToShop')}"));
});
