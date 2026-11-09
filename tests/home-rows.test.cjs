// Home page: Deals and New arrivals rows. Automatic, in stock, never a product already shown above
// (top deals, Featured), and hidden while they have fewer than 4 products. "All deals" opens the
// shop filtered on deals (onSale = an old price above the price), on both server paths.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv, fakeModule, callHandler } = require('./_helpers.cjs');
setTestEnv();

test('server: onSale keeps products whose old price is above the price', async () => {
  const { Product } = require(dist('models/Product.js'));
  const { Category } = require(dist('models/Category.js'));
  const catalog = require(dist('services/catalog.service.js'));
  let seen;
  Category.find = () => ({ select: () => ({ lean: async () => [] }) });
  Product.find = (q) => {
    seen = q;
    const chain = { sort: () => chain, skip: () => chain, limit: () => chain, select: () => chain, populate: () => chain, lean: async () => [], then: (r) => Promise.resolve([]).then(r) };
    return chain;
  };
  Product.countDocuments = async () => 0;
  Product.aggregate = async () => [];
  await catalog.listProducts({ page: 1, limit: 12, onSale: true, admin: true }).catch(() => {});
  assert.ok(JSON.stringify(seen || {}).includes('{"$expr":{"$gt":["$compareAtPrice","$price"]}}'), JSON.stringify(seen));
  const { paginationQuerySchema } = require(dist('validators/schemas.js'));
  assert.equal(paginationQuerySchema.parse({ onSale: 'true' }).onSale, true);
});

test('live site: the products function passes onSale on', async () => {
  const src = fs.readFileSync(api('v1/products.js'), 'utf8');
  assert.match(src, /onSale: raw\.onSale === 'true',/);
  void fakeModule; void callHandler;
});

test('home: two rows, deduplicated, hidden under 4 products; shop understands ?onSale=true', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  const home = src('pages/store/Home.tsx');
  const hook = src('hooks/useHomeRows.ts');
  assert.ok(hook.includes("productsApi.list({ onSale: true, inStock: true, limit: 16 })"), "productsApi.list({ onSale: true, inStock: true, limit: 16 })");
  assert.ok(hook.includes("productsApi.list({ sort: 'newest', inStock: true, limit: 16 })"), "productsApi.list({ sort: 'newest', inStock: true, limit: 16 })");
  assert.ok(hook.includes("!above.has(p._id) && !dealIds.has(p._id)"), "!above.has(p._id) && !dealIds.has(p._id)");
  assert.ok(home.includes("useHomeRows([...deals.products, ...(featured.data ?? []), ...(carousel.data ?? [])])"), "useHomeRows([...deals.products, ...(featured.data ?? []), ...(carousel.data ?? [])])");
  assert.ok(home.includes("viewAll={{ to: '/shop?onSale=true'"), "viewAll={{ to: '/shop?onSale=true'");
  // Admin → Products shows the same rows (same hook), with "hidden" when under 4
  const board = src('components/admin/HomeLayoutBoard.tsx');
  assert.ok(board.includes("useHomeRows([...place.deals.products, ...place.featuredList, ...place.row])"), "useHomeRows([...place.deals.products, ...place.featuredList, ...place.row])");
  for (const t of ['title="Deals"', 'title="New arrivals"', 'Budget · ', 'hidden (needs']) assert.ok(board.includes(t), t);
  const row = src('components/home/HomeProductRow.tsx');
  assert.match(row, /export const HOME_ROW_MIN = 4/);
  assert.match(row, /if \(products\.length < HOME_ROW_MIN\) return null/);
  assert.match(src('pages/store/Shop.tsx'), /onSale: params\.get\('onSale'\) === 'true' \? true : undefined/);
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['dealsKicker', 'dealsTitle', 'dealsBody', 'newKicker', 'newTitle', 'newBody', 'seeAllDeals', 'onSaleOnly']) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});

test('home sections chosen in admin: known sections, valid products, 12 at most, empty = automatic', () => {
  const { sanitizeHomeRows } = require(dist('models/Settings.js'));
  const a = 'a'.repeat(24), b = 'b'.repeat(24);
  const ids = Array.from({ length: 15 }, (_, i) => String(i).padStart(24, 'c'));
  const out = sanitizeHomeRows({ deals: [b, a, a, 'nope'], new: ids, hacker: [a], 'budget-mid': [] }, { 'budget-small': [a] });
  assert.deepEqual(out.deals, [b, a], 'order kept, repeats and bad ids dropped');
  assert.equal(out.new.length, 12);
  assert.equal(out.hacker, undefined);
  assert.equal(out['budget-mid'], undefined, 'empty list = back to automatic');
  assert.deepEqual(out['budget-small'], [a], 'sections not sent are kept');
  const { STOREFRONT_SETTINGS } = require(dist('middleware/auth.js'));
  assert.ok(STOREFRONT_SETTINGS.includes('homeRows'), 'catalog staff can arrange the home page');
  assert.match(fs.readFileSync(api('v1/settings.js'), 'utf8'), /settings\[key\] = sanitizeHomeRows\(body\[key\], settings\.homeRows\);/);
  assert.match(fs.readFileSync(api('v1/products.js'), 'utf8'), /ids: typeof raw\.ids === 'string' \? raw\.ids : undefined,/);
});

test('admin board: rank, move, edit, remove and add on every section; no Manage button', () => {
  const board = fs.readFileSync(path.join(ROOT, 'frontend/src/components/admin/HomeLayoutBoard.tsx'), 'utf8');
  for (const t of ['aria-label="Move left"', 'aria-label="Move right"', 'aria-label="Edit the product"', 'aria-label="Remove from this section"', "full ? `Full (${max})` : 'Add'", 'Back to automatic']) assert.ok(board.includes(t), t);
  assert.ok(!board.includes('/> Manage'), 'no Manage button');
  for (const key of ["key: 'deals'", "key: 'new'", 'key: b.key', "kind: 'homeDeals'", "flag: 'isFeatured'", "flag: 'isCarousel'"]) assert.ok(board.includes(key), key);
});
