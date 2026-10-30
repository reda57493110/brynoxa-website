// Scan fixes:
// - a customer return of a serial-numbered product puts the sold unit back in stock
//   (it used to try to create a second record with the same serial number and fail);
// - any staff member can search products in Admin → Orders → New order on the live site
//   (the serverless handler wanted catalog rights, the Express route only staff);
// - after a deploy, a visitor with the old version open reloads once instead of a broken page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, dist, ROOT, setTestEnv, fakeModule, callHandler } = require('./_helpers.cjs');
setTestEnv();

const { Product } = require(dist('models/Product.js'));
const { InventoryUnit, StockMovement } = require(dist('models/Inventory.js'));
const { moveStock } = require(dist('services/inventoryLedger.service.js'));

const chain = (value) => ({ select: () => chain(value), session: () => chain(value), lean: async () => value, then: (r, j) => Promise.resolve(value).then(r, j) });

function fakeStore(units) {
  const product = { _id: 'p1', name: 'Dell Latitude', sku: 'DL-1', stock: 0, serialTracking: true, costPrice: 2500, inventory: { returned: 0, uncosted: 0, custom: {} } };
  Product.findById = () => chain(product);
  Product.updateOne = async () => ({});
  Product.findOneAndUpdate = () => chain({ ...product, inventory: { ...product.inventory, returned: 1 } });
  StockMovement.exists = () => chain(null);
  StockMovement.create = async (docs) => docs;
  const matches = (u, q) =>
    String(u.product) === String(q.product) && q.serial.$in.includes(u.serial) && u.status === q.status;
  InventoryUnit.find = (q) => chain(units.filter((u) => matches(u, q)));
  InventoryUnit.updateMany = async (q, u) => {
    const hit = units.filter((x) => matches(x, q));
    hit.forEach((x) => Object.assign(x, u.$set));
    return { modifiedCount: hit.length };
  };
  InventoryUnit.create = async (docs) => {
    for (const d of docs) {
      if (units.some((u) => u.serial === d.serial)) throw Object.assign(new Error('dup'), { code: 11000 });
      units.push(d);
    }
    return docs;
  };
  return units;
}

const ret = (serials, extra = {}) => ({
  product: 'p1', qty: serials.length, from: 'external', to: 'returned', type: 'customer-return',
  reason: 'Returned from order #BRX-1: screen', serials, by: 'u1', ...extra,
});

test('a returned serial-numbered unit comes back in stock (the same record, not a new one)', async () => {
  const units = fakeStore([{ product: 'p1', serial: 'SN-123', status: 'sold', unitCost: 2400 }]);
  const out = await moveStock(ret(['SN-123']));
  assert.equal(out.duplicate, false);
  assert.equal(units.length, 1, 'no second record');
  assert.equal(units[0].status, 'returned');
  assert.equal(units[0].unitCost, 2400, 'history kept');
});

test('a returned unit the shop never recorded is added; a supplier delivery still refuses a known serial', async () => {
  const units = fakeStore([{ product: 'p1', serial: 'SN-123', status: 'sold' }]);
  await moveStock(ret(['SN-123', 'SN-NEW']));
  assert.deepEqual(units.map((u) => [u.serial, u.status]), [['SN-123', 'returned'], ['SN-NEW', 'returned']]);

  fakeStore([{ product: 'p1', serial: 'SN-9', status: 'sold' }]);
  await assert.rejects(
    moveStock({ product: 'p1', qty: 1, from: 'external', to: 'available', type: 'supplier-receipt', reason: 'Delivery', serials: ['SN-9'] }),
    /already registered/
  );
});

test('product search for staff: any staff role on the live site, as on the local server', async () => {
  const roles = [];
  fakeModule(api('_lib/mongo.js'), { connectMongo: async () => ({}) });
  fakeModule(api('_lib/rateLimit.js'), { rateLimit: async () => true });
  fakeModule(api('_lib/auth.js'), {
    optionalUser: async () => null,
    requireStaff: async (_req, _res, permissions = []) => {
      roles.push(permissions);
      return { _id: 'u1', role: 'orders' };
    },
  });
  const catalog = require(dist('services/catalog.service.js'));
  catalog.listProducts = async (q) => ({ items: [], page: 1, limit: q.limit, total: 0, admin: q.admin });
  const handler = require(api('v1/products.js'));
  const r = await callHandler(handler, { url: '/api/v1/products?admin=true&q=dell' });
  assert.equal(r.status, 200);
  assert.deepEqual(roles, [[]], 'no catalog permission required');
  const controller = fs.readFileSync(dist('controllers/catalog.controller.js'), 'utf8');
  assert.match(controller, /isStaffRole\)\(req\.user\?\.role\) && req\.query\.admin === 'true'/);
});

test('after a deploy the shop reloads once for the new version', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  const lib = src('lib/newVersion.ts');
  assert.match(lib, /vite:preloadError/);
  assert.match(lib, /Date\.now\(\) - last < 30_000/, 'never loops');
  assert.match(src('main.tsx'), /watchForNewVersion\(\)/);
  assert.match(src('main.tsx'), /isChunkLoadError\(error\) && reloadForNewVersion\(\)/);
  assert.match(src('components/ui/ErrorBoundary.tsx'), /isChunkLoadError\(error\) && reloadForNewVersion\(\)/);
});
