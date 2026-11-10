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
  assert.ok(fn.includes("  'categoryHeroes',\n];"), 'the live-site function accepts it');
  assert.ok(fn.includes('settings[key] = sanitizeCategoryHeroes(body[key], settings.categoryHeroes);'));
  assert.ok(fs.readFileSync(path.join(ROOT, 'backend/src/controllers/misc.controller.ts'), 'utf8').includes('body.categoryHeroes = sanitizeCategoryHeroes(body.categoryHeroes, settings.categoryHeroes);'));
});

test('shop: the header follows the category; admin tab "Shop page header"', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  assert.ok(src('pages/store/Shop.tsx').includes('category={activeCategory ? { slug: activeCategory.slug, main: activeMain?.slug } : undefined}'));
  assert.ok(src('components/layout/StoreHero.tsx').includes('const { product, pending } = useHeroProduct(page, category)'));
  const hook = src('hooks/useHeroProduct.ts');
  assert.ok(hook.includes("productsApi.list({ category: cat!.slug, inStock: true, sort: 'popular', limit: 12 })"), 'in stock, from that category');
  assert.ok(hook.includes("const own = cat && !categoryChoice ? '' : pick.value"), 'the shop header choice never hides the category product');
  assert.ok(hook.includes("const needAuto = Boolean(page) && page !== 'shop' && !cat && settings.isSuccess"), 'a category never borrows the shop product (no laptop on Cameras)');
  assert.ok(hook.includes("? 'empty-category'"), 'nothing in stock: the category photo');
  const shop = src('pages/store/Shop.tsx');
  assert.ok(shop.includes('image={(activeCategory && categoryPhoto(activeCategory, categoryList)) || SHOP_HERO_IMAGE}'), 'the category photo in the header');
  assert.ok(shop.includes('photoCard={Boolean(activeCategory && categoryPhoto(activeCategory, categoryList))}'));
  assert.ok(src('components/layout/StoreHero.tsx').includes("!photoCard && 'md:dark:hidden!'"), 'framed in dark mode too');
  const board = src('components/admin/HomeLayoutBoard.tsx');
  assert.ok(board.includes("{ id: 'shop', label: 'Shop page header', icon: 'cart', href: '/shop' }"));
  assert.ok(board.includes('<ShopHeaderBoard />'));
  const shopBoard = src('components/admin/ShopHeaderBoard.tsx');
  for (const t of ['All products (no category chosen)', 'Photo only', 'Automatic', "{yours && setting !== HERO_NONE ? 'Change' : 'Choose'}", 'save.mutateAsync({ categoryHeroes: { [slug]: value } })', 'sub-categories']) {
    assert.ok(shopBoard.includes(t), t);
  }
});

test('shop "All": photos of the categories, not one laptop; a product only if chosen for All', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  const shop = src('pages/store/Shop.tsx');
  assert.ok(shop.includes('mosaic={activeCategory ? undefined : allTiles}'));
  assert.ok(shop.includes("const ALL_TILE_ORDER = ['laptops', 'gaming-pcs', 'desktop-pcs', 'monitors', 'accessories', 'components', 'cameras']"));
  const hero = src('components/layout/StoreHero.tsx');
  assert.ok(hero.includes('<HeroMosaic tiles={mosaic!} />') && hero.includes('const shown = tiles.slice(0, 4)'));
  assert.ok(src('hooks/useHeroProduct.ts').includes("page !== 'shop' && !cat"), 'no automatic product on the shop');
  // Every place that chose the old Shop header product now saves the choice for All
  assert.ok(src('pages/admin/ProductForm.tsx').includes('adminApi.settings.update({ categoryHeroes: { all: savedId } })'));
  assert.ok(src('components/admin/ProductPlacementDialog.tsx').includes('updateSettings.mutate({ categoryHeroes: { all: p._id } })'));
  assert.ok(src('components/admin/ShopHeaderBoard.tsx').includes('save={saveFor(SHOP_ALL)}'));
  assert.ok(!src('pages/admin/Settings.tsx').includes('<PageHeaderProducts'), 'Settings points to Products → Shop page header');
  assert.ok(fs.readFileSync(path.join(ROOT, 'frontend/public/preload.js'), 'utf8').includes('s.data.categoryHeroes && s.data.categoryHeroes.all'));
});
