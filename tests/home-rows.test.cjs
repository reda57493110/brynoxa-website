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
  assert.match(home, /productsApi\.list\(\{ onSale: true, inStock: true, limit: 16 \}\)/);
  assert.match(home, /productsApi\.list\(\{ sort: 'newest', inStock: true, limit: 16 \}\)/);
  assert.match(home, /\[\.\.\.deals\.products, \.\.\.\(featured\.data \?\? \[\]\), \.\.\.\(carousel\.data \?\? \[\]\)\]/);
  assert.match(home, /!shownAbove\.has\(p\._id\) && !dealsIds\.has\(p\._id\)/);
  assert.match(home, /viewAll=\{\{ to: '\/shop\?onSale=true'/);
  const row = src('components/home/HomeProductRow.tsx');
  assert.match(row, /export const HOME_ROW_MIN = 4/);
  assert.match(row, /if \(products\.length < HOME_ROW_MIN\) return null/);
  assert.match(src('pages/store/Shop.tsx'), /onSale: params\.get\('onSale'\) === 'true' \? true : undefined/);
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['dealsKicker', 'dealsTitle', 'dealsBody', 'newKicker', 'newTitle', 'newBody', 'seeAllDeals', 'onSaleOnly']) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});
