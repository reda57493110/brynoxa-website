// Live (serverless) API safety: no internal error details, page-size cap, reviews off,
// hidden categories for staff only, health page without database, browser security rules.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { ROOT, api, dist, setTestEnv, fakeModule, callHandler } = require('./_helpers.cjs');
setTestEnv();

fakeModule(api('_lib/mongo.js'), { connectMongo: async () => ({ db: { collection: () => ({}) } }) });
let currentUser = null;
fakeModule(api('_lib/auth.js'), { optionalUser: async () => currentUser, requireUser: async () => currentUser, requireStaff: async () => currentUser });

const { sendError } = require(api('_lib/http'));
const reply = (err) => {
  let out;
  sendError({ setHeader() {}, end(b) { out = { status: this.statusCode, ...JSON.parse(b) }; } }, err);
  return out;
};

test('errors: expected problems keep their message, crashes show nothing internal', () => {
  assert.deepEqual(reply(Object.assign(new Error('Order not found'), { statusCode: 404 })), { status: 404, success: false, message: 'Order not found' });
  const crash = reply(new Error('MongoServerSelectionError: connect ECONNREFUSED cluster0-shard-00-01.abcde.mongodb.net:27017'));
  assert.equal(crash.status, 500);
  assert.doesNotMatch(crash.message, /mongo|cluster|ECONN/i);
  assert.deepEqual(reply(Object.assign(new Error('Cast to ObjectId failed'), { name: 'CastError' })).message, 'Invalid id');
  assert.equal(reply(Object.assign(new Error('Path `name` is required.'), { name: 'ValidationError' })).status, 400);
});

test('page size is capped at 100 (limit=0 does not mean "everything")', async () => {
  const { paging } = require(api('_lib/paging'));
  assert.deepEqual(paging({ limit: '12', page: '2' }, 12), { page: 2, limit: 12 });
  assert.deepEqual(paging({ limit: '60' }, 12), { page: 1, limit: 60 });
  assert.deepEqual(paging({ limit: '100000' }), { page: 1, limit: 100 });
  assert.deepEqual(paging({ limit: '0' }, 12), { page: 1, limit: 12 });
  assert.deepEqual(paging({ page: '-5', limit: 'abc' }, 12), { page: 1, limit: 12 });

  const catalog = require(dist('services/catalog.service'));
  let seen;
  catalog.listProducts = async (q) => {
    seen = q;
    return { items: [], page: q.page, limit: q.limit, total: 0 };
  };
  const products = require(api('v1/products.js'));
  await callHandler(products, { url: '/api/v1/products?limit=5000' });
  assert.equal(seen.limit, 100);
  const r = await callHandler(products, { url: '/api/v1/products?__route=' + 'a'.repeat(24) + '/reviews' });
  assert.equal(r.status, 404, 'product reviews are switched off');
});

test('hidden categories are only listed for staff', async () => {
  const catalog = require(dist('services/catalog.service'));
  let activeOnly;
  catalog.listCategories = async (a) => {
    activeOnly = a;
    return [];
  };
  const cats = require(api('v1/categories.js'));
  const ask = async (url, user) => {
    currentUser = user;
    await callHandler(cats, { url });
    return activeOnly;
  };
  assert.equal(await ask('/api/v1/categories?all=true', null), true);
  assert.equal(await ask('/api/v1/categories?all=true', { role: 'customer' }), true);
  assert.equal(await ask('/api/v1/categories?all=true', { role: 'catalog' }), false);
  assert.equal(await ask('/api/v1/categories', null), true);
  currentUser = null;
});

test('health page answers without the database; reviews and db-ping are gone', async () => {
  const health = require(api('v1/health.js'));
  const r = await callHandler(health, { url: '/api/v1/health?__resource=db-ping' });
  assert.equal(r.status, 200);
  assert.match(r.body.message, /API OK/);
  const vercel = JSON.parse(fs.readFileSync(ROOT + '/vercel.json', 'utf8'));
  const text = JSON.stringify(vercel);
  assert.doesNotMatch(text, /db-ping|reviews/);
  assert.equal(fs.existsSync(api('v1/reviews.js')), false);
  const router = require(dist('routes/commerce.routes')).default;
  const paths = router.stack.filter((l) => l.route).map((l) => l.route.path);
  assert.equal(paths.some((p) => /review/i.test(p)), false);
});

test('browser security rules: connections only to this site and Google Analytics', () => {
  const csp = fs.readFileSync(ROOT + '/vercel.json', 'utf8').match(/connect-src[^;]*/)[0];
  assert.doesNotMatch(csp + ' ', / https:(?!\/\/)/);
  assert.match(csp, /'self'/);
});

test('caching: shop lists are shared for 60 s at the edge; staff-only answers never are', async () => {
  const catalog = require(dist('services/catalog.service'));
  catalog.listProducts = async (q) => ({ items: [], page: q.page, limit: q.limit, total: 0 });
  catalog.listCategories = async () => [];
  catalog.listBrands = async () => [];
  const products = require(api('v1/products.js'));
  const cats = require(api('v1/categories.js'));
  const shared = /public, max-age=0, s-maxage=60/;

  let r = await callHandler(products, { url: '/api/v1/products?featured=true&limit=4' });
  assert.match(r.headers['cache-control'], shared, 'shop product list');
  currentUser = { role: 'catalog' };
  r = await callHandler(products, { url: '/api/v1/products?admin=true&limit=20' });
  assert.equal(r.headers['cache-control'], 'private, no-store', 'admin product list (hidden products)');
  r = await callHandler(cats, { url: '/api/v1/categories?all=true' });
  assert.equal(r.headers['cache-control'], 'private, no-store', 'categories incl. hidden');
  r = await callHandler(cats, { url: '/api/v1/categories?__resource=brands&all=true' });
  assert.equal(r.headers['cache-control'], 'private, no-store', 'brands incl. hidden');
  currentUser = null;
  r = await callHandler(cats, { url: '/api/v1/categories' });
  assert.match(r.headers['cache-control'], shared, 'shop categories');
  r = await callHandler(cats, { url: '/api/v1/categories?__resource=brands' });
  assert.match(r.headers['cache-control'], shared, 'shop brands');
});

test('caching: public settings are shared, private payment details are never in them', async () => {
  const Settings = require(dist('models/Settings'));
  Settings.getSettings = async () => ({ toObject: () => ({ storeName: 'Brynoxa', depositMethods: [{ account: 'SECRET-RIB' }], depositInstructions: 'x', courierCosts: { delivered: 35 }, paymentDetailsChangedBy: 'Owner' }) });
  const settings = require(api('v1/settings.js'));
  const r = await callHandler(settings, { url: '/api/v1/settings' });
  assert.match(r.headers['cache-control'], /s-maxage=60/);
  assert.equal(r.body.data.storeName, 'Brynoxa');
  assert.doesNotMatch(JSON.stringify(r.body), /SECRET-RIB|depositInstructions|courierCosts|paymentDetailsChangedBy/);
});

test('signed-in staff skip the shared copy (frontend adds a fresh parameter)', () => {
  const client = fs.readFileSync(ROOT + '/frontend/src/api/client.ts', 'utf8');
  assert.match(client, /isStaffRole\(user\?\.role\) && SHARED_CACHE_PATH\.test/);
  const re = new RegExp(client.match(/SHARED_CACHE_PATH = \/(.+)\/\n/)[1]);
  for (const p of ['/products', '/products?featured=true', '/products/hp-elitebook', '/categories', '/brands', '/settings']) assert.ok(re.test(p), p);
  for (const p of ['/admin/settings', '/orders', '/auth/me', '/wishlist']) assert.equal(re.test(p), false, p);
});

test('server runs in Paris (cdg1), next to the MongoDB Atlas cluster (AWS Paris eu-west-3)', () => {
  const vercel = JSON.parse(fs.readFileSync(ROOT + '/vercel.json', 'utf8'));
  assert.deepEqual(vercel.regions, ['cdg1']);
});
