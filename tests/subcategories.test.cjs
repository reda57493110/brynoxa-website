// Sub-categories (two levels): Components › RAM, Storage…
// - a main category also lists the products of its sub-categories;
// - hiding a main category hides its sub-categories in the shop;
// - a category goes inside a main one only (no third level, not inside itself);
// - "Add suggested categories" creates only the missing ones: Desktop PCs and Cameras (main), and
//   the sub-categories under the main ones that exist;
// - the live site (api/v1/admin.js) handles the button.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, dist, ROOT, setTestEnv, fakeModule, callHandler } = require('./_helpers.cjs');
setTestEnv();

const { Category } = require(dist('models/Category.js'));
const catalog = require(dist('services/catalog.service.js'));
const { CATEGORY_SUGGESTIONS } = require(dist('utils/categorySuggestions.js'));
// The real one (a later test replaces it on the module for the live-site check)
const addSuggestedCategories = catalog.addSuggestedCategories;

const id = (n) => String(n).padStart(24, '0');
const cats = [
  { _id: id(1), slug: 'components', isActive: true, parent: null },
  { _id: id(2), slug: 'ram', isActive: true, parent: id(1) },
  { _id: id(3), slug: 'storage', isActive: false, parent: id(1) },
  { _id: id(4), slug: 'accessories', isActive: false, parent: null },
  { _id: id(5), slug: 'webcams', isActive: true, parent: id(4) },
  { _id: id(6), slug: 'laptops', isActive: true, parent: null },
];

test('a main category includes its sub-categories', () => {
  assert.deepEqual(catalog.categoryAndChildren(id(1), cats).sort(), [id(1), id(2), id(3)]);
  assert.deepEqual(catalog.categoryAndChildren(id(2), cats), [id(2)]);
});

test('shop: hidden categories and sub-categories of a hidden one are not shown', () => {
  const visible = catalog.visibleCategoryIds(cats);
  assert.ok(visible.has(id(1)) && visible.has(id(2)) && visible.has(id(6)));
  assert.ok(!visible.has(id(3)), 'hidden itself');
  assert.ok(!visible.has(id(4)) && !visible.has(id(5)), 'webcams hidden with accessories');
});

const lean = (v) => ({ select: () => ({ lean: async () => v }), lean: async () => v });

test('inside a main category only: no third level, not inside itself, not when it has sub-categories', async () => {
  Category.findById = (x) => lean(cats.find((c) => c._id === String(x)) || null);
  Category.exists = async (q) => cats.some((c) => String(c.parent) === String(q.parent));
  Category.findOne = async () => null;
  Category.create = async (d) => d;
  await assert.rejects(catalog.createCategory({ name: 'DDR5', parent: id(2) }), /main category/);
  await assert.rejects(catalog.createCategory({ name: 'X', parent: 'nope' }), /existing category/);
  const made = await catalog.createCategory({ name: 'Graphics cards', parent: id(1) });
  assert.equal(String(made.parent), id(1));
  // updateCategory: itself / a main category that has sub-categories
  const doc = { ...cats[0], save: async () => {} };
  Category.findById = (x) => {
    const found = cats.find((c) => c._id === String(x));
    const chain = Promise.resolve(String(x) === id(1) ? doc : found || null);
    chain.select = () => lean(found || null);
    return chain;
  };
  await assert.rejects(catalog.updateCategory(id(1), { parent: id(1) }), /inside itself/);
  await assert.rejects(catalog.updateCategory(id(1), { parent: id(6) }), /has sub-categories/);
});

test('suggested sub-categories: only the missing ones, under the main ones that exist', async () => {
  const created = [];
  Category.find = (q) => {
    if (q && 'parent' in q) return lean([{ _id: id(1), slug: 'components', sortOrder: 3 }]);
    return lean(cats.map((c) => ({ slug: c.slug })));
  };
  Category.create = async (d) => created.push(d);
  const r = await catalog.addSuggestedCategories();
  const expected = CATEGORY_SUGGESTIONS.components.filter((s) => !['ram', 'storage'].includes(s.slug));
  assert.equal(r.created, 2 + expected.length);
  assert.deepEqual(created.map((c) => c.slug), ['desktop-pcs', 'cameras', ...expected.map((s) => s.slug)]);
  assert.ok(created.slice(0, 2).every((c) => c.parent === null), 'main categories');
  assert.ok(created.slice(2).every((c) => String(c.parent) === id(1)));
  // Every main category of the shop has suggestions, each address used once
  for (const main of ['laptops', 'desktop-pcs', 'gaming-pcs', 'monitors', 'components', 'mice', 'keyboards', 'headphones', 'accessories', 'cameras']) {
    assert.ok(CATEGORY_SUGGESTIONS[main].length >= 3, main);
  }
  const all = Object.values(CATEGORY_SUGGESTIONS).flat().map((s) => s.slug);
  assert.equal(new Set(all).size, all.length);
});

test('every suggested sub-category is named in French and Arabic', () => {
  const src = (l) => fs.readFileSync(path.join(ROOT, `frontend/src/i18n/${l}.ts`), 'utf8');
  for (const s of Object.values(CATEGORY_SUGGESTIONS).flat()) {
    const k = /^[a-z][a-z0-9]*$/.test(s.slug) ? `${s.slug}: {` : `'${s.slug}': {`;
    for (const l of ['en', 'fr', 'ar']) assert.ok(src(l).includes(k), `${l}: ${s.slug}`);
  }
  assert.match(src('fr'), /ram: \{ name: 'Mémoire RAM'/);
  assert.match(src('fr'), /storage: \{ name: 'Stockage \(SSD et HDD\)'/);
});

test('live site: the button reaches the code (api/v1/admin.js)', async () => {
  fakeModule(api('_lib/mongo.js'), { connectMongo: async () => ({}) });
  fakeModule(api('_lib/auth.js'), { requireStaff: async () => ({ _id: 'u1', role: 'owner' }), optionalUser: async () => null });
  catalog.addSuggestedCategories = async () => ({ created: 7, mains: ['components'] });
  const admin = require(api('v1/admin.js'));
  const res = await callHandler(admin, { method: 'POST', url: '/api/v1/admin?__route=categories/suggested', headers: {} });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.created, 7);
  assert.match(fs.readFileSync(dist('routes/catalog.routes.js'), 'utf8'), /router\.post\('\/admin\/categories\/suggested'/);
});

test('Cameras: a main category with security cameras, webcams, action and photo cameras', () => {
  assert.deepEqual(CATEGORY_SUGGESTIONS.cameras.map((c) => c.slug), ['security-cameras', 'webcams', 'action-cameras', 'digital-cameras', 'camera-accessories']);
  const { MAIN_CATEGORY_SUGGESTIONS } = require(dist('utils/categorySuggestions.js'));
  assert.deepEqual(MAIN_CATEGORY_SUGGESTIONS.map((c) => c.slug), ['desktop-pcs', 'cameras']);
  assert.match(fs.readFileSync(path.join(ROOT, 'frontend/src/i18n/fr.ts'), 'utf8'), /cameras: [{] name: 'Caméras'/);
  assert.match(fs.readFileSync(path.join(ROOT, 'frontend/src/i18n/fr.ts'), 'utf8'), /'security-cameras': [{] name: 'Caméras de surveillance'/);
  assert.ok(fs.readFileSync(path.join(ROOT, 'frontend/src/lib/categoryIcon.ts'), 'utf8').includes("key.includes('camera')"));
});

test('your own "camera" and "desktop-pc" count as Cameras and Desktop PCs: no copies, their sub-categories go inside them', async () => {
  const created = [];
  const mine = [{ _id: id(7), slug: 'camera' }, { _id: id(8), slug: 'desktop-pc' }];
  Category.find = (q) => lean(q && 'parent' in q ? mine : mine.map((c) => ({ slug: c.slug })));
  Category.create = async (d) => created.push(d);
  await addSuggestedCategories();
  assert.ok(!created.some((c) => c.slug === 'cameras' || c.slug === 'desktop-pcs'), 'no second main category');
  assert.ok(created.filter((c) => String(c.parent) === id(7)).some((c) => c.slug === 'security-cameras'));
  assert.ok(created.filter((c) => String(c.parent) === id(8)).some((c) => c.slug === 'mini-pcs'));
});
