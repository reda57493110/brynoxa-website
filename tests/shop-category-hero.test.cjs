// Shop page header per category: Desktop PC shows a desktop, Laptops a laptop… Chosen in Admin →
// Products → "Shop page header" (Settings → categoryHeroes); nothing chosen = one of the
// category's own products. Saved on both server paths, by catalog staff too.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

test('server: a product id or "none" per category address; "" = automatic; others kept', () => {
  const { sanitizeCategoryHeroes } = require(dist('models/Settings.js'));
  const a = 'a'.repeat(24);
  const b = 'b'.repeat(24);
  const out = sanitizeCategoryHeroes({ laptops: a, 'desktop-pc': 'none', mice: 'hack', 'Bad Slug': a, '$where': a }, { monitors: b, mice: b });
  assert.deepEqual(out, { monitors: b, laptops: a, 'desktop-pc': 'none' }, 'bad values remove the line, bad addresses are ignored');
  assert.deepEqual(sanitizeCategoryHeroes({ laptops: '' }, { laptops: a, monitors: b }), { monitors: b }, "'' = back to automatic");
  assert.deepEqual(sanitizeCategoryHeroes('nope', { laptops: a }), { laptops: a });
  const { settingsSchema } = require(dist('validators/schemas.js'));
  assert.ok(settingsSchema.shape.categoryHeroes.safeParse({ laptops: a, 'desktop-pc': 'none', mice: '' }).success);
  const { STOREFRONT_SETTINGS } = require(dist('middleware/auth.js'));
  assert.ok(STOREFRONT_SETTINGS.includes('categoryHeroes'), 'catalog staff can choose them');
  const fn = fs.readFileSync(api('v1/settings.js'), 'utf8');
  assert.ok(fn.includes("  'categoryHeroes',\n"), 'the live-site function accepts it');
  assert.ok(fn.includes('settings[key] = sanitizeCategoryHeroes(body[key], settings.categoryHeroes);'));
  assert.ok(fs.readFileSync(path.join(ROOT, 'backend/src/controllers/misc.controller.ts'), 'utf8').includes('body.categoryHeroes = sanitizeCategoryHeroes(body.categoryHeroes, settings.categoryHeroes);'));
});

test('shop: the header follows the category; admin tab "Shop page header"', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  assert.ok(src('components/layout/StoreHero.tsx').includes('const hero = useHeroProduct(page, category)'));
  const hook = src('hooks/useHeroProduct.ts');
  assert.ok(hook.includes("productsApi.list({ category: cat!.slug, inStock: true, sort: 'popular', limit: 12 })"), 'in stock, from that category');
  assert.ok(hook.includes("const own = cat && !categoryChoice ? '' : pick.value"), 'the shop header choice never hides the category product');
  assert.ok(hook.includes("const needAuto = Boolean(page) && page !== 'shop' && !cat && settings.isSuccess"), 'a category never borrows the shop product (no laptop on Cameras)');
  assert.ok(hook.includes("? 'empty-category'"), 'nothing in stock: the category photo');
  assert.ok(src('components/layout/StoreHero.tsx').includes("!photoCard && 'md:dark:hidden!'"), 'framed in dark mode too');
  // The shop has no header product any more (search bar only): its Admin tab, form box and
  // placement row are gone too (Nov 2026)
  const board = src('components/admin/HomeLayoutBoard.tsx');
  assert.ok(!board.includes("label: 'Shop header'") && !board.includes('ShopHeaderBoard'));
  assert.ok(!fs.existsSync(path.join(ROOT, 'frontend/src/components/admin/ShopHeaderBoard.tsx')));
});

test('shop "All": one product per category in turn, not always the same laptop; one product only if chosen for All', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  // (The shop page itself no longer shows a header product: only the search bar — Nov 2026)
  const hero = src('components/layout/StoreHero.tsx');
  assert.ok(hero.includes('<RotatingHeroCard products={rotate!} />'));
  assert.ok(hero.includes('export const HERO_ROTATE_MS = 5000'));
  assert.ok(hero.includes("prefers-reduced-motion: reduce") && hero.includes('onMouseEnter={() => setPaused(true)}'), 'stops for less motion and on hover');
  assert.ok(!hero.includes('HeroMosaic'), 'no category photo collage');
  assert.ok(src('hooks/useHeroProduct.ts').includes("page !== 'shop' && !cat"), 'no automatic product on the shop');
  // Nothing in Admin offers the Shop header product any more
  assert.ok(!src('pages/admin/ProductForm.tsx').includes('categoryHeroes'));
  assert.ok(!src('components/admin/ProductPlacementDialog.tsx').includes('title="Shop header"'));
  assert.ok(!src('hooks/useStorefrontPlacements.ts').includes("key: 'shopHeader'"));
  assert.ok(!src('pages/admin/Settings.tsx').includes('<PageHeaderProducts'), 'Settings points to Products → Shop page header');
  assert.ok(!fs.readFileSync(path.join(ROOT, 'frontend/public/preload.js'), 'utf8').includes('s.data.categoryHeroes && s.data.categoryHeroes.all'), 'nothing to start early for it');
});

