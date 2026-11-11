// "Pick your setup" (/setups): a product shows on the setups ticked in admin, or (none ticked) on
// the setups of its category. Both server paths (Express and the live-site function) pass ?setup=.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

test('server: ?setup=gaming = ticked for gaming, or nothing ticked and in a gaming category', async () => {
  const { Product } = require(dist('models/Product.js'));
  const { Category } = require(dist('models/Category.js'));
  const catalog = require(dist('services/catalog.service.js'));
  const { SETUP_CATEGORIES } = require(dist('utils/setups.js'));
  let asked;
  let seen;
  Category.find = (q) => {
    if (q && q.slug) asked = q.slug.$in;
    const rows = q && q.slug ? [{ _id: 'cat-gaming-pcs' }] : [{ _id: 'cat-gaming-pcs', isActive: true, slug: 'gaming-pcs', parent: null }];
    return { select: () => ({ lean: async () => rows }) };
  };
  Product.find = (q) => {
    seen = q;
    const chain = { sort: () => chain, skip: () => chain, limit: () => chain, select: () => chain, populate: () => chain, lean: async () => [], then: (r) => Promise.resolve([]).then(r) };
    return chain;
  };
  Product.countDocuments = async () => 0;
  Product.aggregate = async () => [];
  await catalog.listProducts({ page: 1, limit: 100, setup: 'gaming', admin: true }).catch(() => {});
  assert.deepEqual(asked, SETUP_CATEGORIES.gaming);
  assert.ok(
    JSON.stringify(seen || {}).includes('{"$or":[{"setups":"gaming"},{"setups.0":{"$exists":false},"category":{"$in":["cat-gaming-pcs"]}}]}'),
    JSON.stringify(seen)
  );
  seen = undefined;
  await catalog.listProducts({ page: 1, limit: 12, setup: 'hacker', admin: true }).catch(() => {});
  assert.ok(!JSON.stringify(seen || {}).includes('setups'), 'unknown setup = no filter');
});

test('product form: only known setups are saved; none = by its category', () => {
  const { productSchema, paginationQuerySchema } = require(dist('validators/schemas.js'));
  const { sanitizeSetups } = require(dist('utils/setups.js'));
  const ok = productSchema.shape.setups;
  assert.ok(ok.safeParse(['gaming', 'work']).success);
  assert.equal(ok.safeParse(['hacker']).success, false);
  assert.deepEqual(sanitizeSetups(['work', 'gaming', 'work', 'x']), ['gaming', 'work']);
  assert.deepEqual(sanitizeSetups([]), []);
  assert.equal(sanitizeSetups(undefined), undefined, 'not sent = untouched');
  assert.equal(paginationQuerySchema.parse({ setup: 'study' }).setup, 'study');
  assert.equal(paginationQuerySchema.safeParse({ setup: 'nope' }).success, false);
  const svc = fs.readFileSync(path.join(ROOT, 'backend/src/services/catalog.service.ts'), 'utf8');
  assert.ok(svc.includes("if (setups) product.set('setups', setups.length ? setups : undefined);"), 'update saves / clears setups');
  assert.ok(svc.includes('setups: sanitizeSetups(data.setups)?.length ? sanitizeSetups(data.setups) : undefined,'), 'create saves setups');
  assert.ok(fs.readFileSync(api('v1/products.js'), 'utf8').includes("setup: typeof raw.setup === 'string' ? raw.setup : undefined,"));
});

test('shop: "Grab your setup" opens /setups; page, routes, sitemap, admin ticks and texts', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  const home = src('pages/store/Home.tsx');
  const i = home.indexOf("{t('home.heroCtaShop')}");
  assert.ok(home.slice(Math.max(0, i - 600), i).includes('to="/setups"'), 'hero button goes to /setups');
  const router = src('app/router.tsx');
  assert.ok(router.includes('<Route path="setups" element={<S><Setups /></S>} />'));
  assert.ok(router.includes('<Route path="setups/:kind" element={<S><Setups /></S>} />'));
  const page = src('pages/store/Setups.tsx');
  const hook = src('hooks/useSetupLists.ts');
  assert.ok(page.includes('const byId = useSetupLists()'), 'page and admin board share one source');
  assert.ok(hook.includes('productsApi.list({ setup: id, inStock: true'), 'in stock only');
  assert.ok(hook.includes('.filter((p) => setupsFor(p).includes(id))'), 'the product words decide inside shared categories');
  assert.ok(page.includes('t(`setups.groups.${active}.${g.piece}`)'), 'group names per setup (Gaming mice, Laptops for learning)');
  assert.ok(page.includes('<ProductCarousel products={g.items} />'), 'phones: moving rows, the same size as every carousel');
  assert.ok(page.includes('mt-5 grid grid-cols-4 gap-1.5'), 'the 4 setups in one row of small cards');
  assert.ok(page.includes('font-display text-2xl font-semibold tracking-tight sm:text-4xl'), 'smaller title');
  // Simple page: no repeated setup box, no chips, no box around groups, no long texts
  for (const gone of ['.intro`)}</p>', "t('setups.inside')", "t('setups.from'", "t('setups.moreBody')", "t('setups.helpBody')", '.tagline`)']) assert.ok(!page.includes(gone), gone);
  assert.ok(!page.includes('heroPerk'), 'no repeated promises under the title');
  assert.ok(page.includes('max-sm:mx-auto max-sm:w-[min(14rem,62vw)]'), 'phones: a single product in the middle, carousel size');
  assert.ok(page.includes("SPAN_LG[Math.min(n, 4)]") && page.includes('[grid-auto-flow:row_dense]'), 'small groups sit side by side, no empty half rows');
  assert.ok(page.includes("t(n === 1 ? 'setups.countOne' : 'setups.count'"), '1 product, not 1 products');
  assert.ok(fs.readFileSync(api('sitemap.js'), 'utf8').includes("{ path: '/setups', changefreq: 'weekly', priority: '0.8' }"));
  const form = src('pages/admin/ProductForm.tsx');
  assert.ok(form.includes('setups: SETUP_IDS.filter((s) => form.setups.includes(s)),'), 'admin sends the ticks');
  assert.ok(form.includes('None ticked = by its category'));
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    const start = t.indexOf('\n  setups: {');
    assert.ok(start > 0, l);
    const block = t.slice(start, t.indexOf('\n  },', start));
    for (const k of ['kicker', 'title', 'body', 'count', 'from', 'inside', 'empty', 'browseAll', 'helpTitle', 'helpBody', 'helpCta', 'countOne', 'groups', 'pc', 'laptop', 'screen', 'mouse', 'keyboard', 'headset', 'webcam', 'camera', 'components', 'accessories', 'gaming', 'study', 'work', 'creator', 'tagline', 'intro']) {
      assert.ok(block.includes(`${k}: `), `${l}: ${k}`);
    }
  }
});
