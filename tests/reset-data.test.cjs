// Admin → Security → "Empty the test data" (owner only): refuses anyone else, a wrong password or
// a wrong word; deletes only the ticked groups (stock goes with products, orders with customers);
// never deletes staff, categories, brands or coupons; logs a line in Team history.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const models = {
  User: require(dist('models/User')).User,
  Product: require(dist('models/Product')).Product,
  Order: require(dist('models/Order')).Order,
  Settings: require(dist('models/Settings')).Settings,
  Coupon: require(dist('models/Coupon')).Coupon,
  StaffAction: require(dist('models/StaffAction')).StaffAction,
  StockMovement: require(dist('models/Inventory')).StockMovement,
  Expense: require(dist('models/Expense')).Expense,
  ContactMessage: require(dist('models/Contact')).ContactMessage,
};
const Category = require(dist('models/Category')).Category;
const Brand = require(dist('models/Brand')).Brand;

let calls;
let owner;
const OWNER_ID = '64a000000000000000000001';
const lean = (v) => ({ select: () => ({ lean: async () => v }), lean: async () => v });

beforeEach(() => {
  calls = [];
  owner = { _id: OWNER_ID, role: 'admin', isActive: true, comparePassword: async (p) => p === 'right-password' };
  // Every collection of the app: record deletes / updates instead of touching a database
  for (const m of Object.values(require(path.join(ROOT, 'backend/node_modules/mongoose')).models)) {
    m.deleteMany = async (filter) => {
      calls.push(['delete', m.modelName, filter]);
      return { deletedCount: 2 };
    };
    m.updateMany = async (filter, update) => {
      calls.push(['update', m.modelName, update]);
      return {};
    };
    m.countDocuments = async () => 2;
  }
  models.User.findById = () => ({ select: async () => owner });
  models.User.find = () => lean([{ _id: OWNER_ID }]);
  models.Product.find = () => lean([{ images: [] }]);
  models.StaffAction.create = async (doc) => calls.push(['log', doc.action]);
});

const reset = require(dist('services/resetData.service'));
const run = (o = {}) => reset.resetTestData({ ownerId: OWNER_ID, password: 'right-password', confirm: 'EMPTY', groups: ['orders'], ...o });
const deleted = () => calls.filter((c) => c[0] === 'delete').map((c) => c[1]);

test('refuses: not the owner, a disabled owner, the wrong word, the wrong password, nothing chosen', async () => {
  owner.role = 'orders';
  await assert.rejects(run(), /Only the owner/);
  owner.role = 'admin';
  owner.isActive = false;
  await assert.rejects(run(), /Only the owner/);
  owner.isActive = true;
  await assert.rejects(run({ confirm: 'empty please' }), /Type EMPTY/);
  await assert.rejects(run({ password: 'wrong' }), /Wrong password/);
  await assert.rejects(run({ groups: ['nonsense'] }), /Choose what to empty/);
  assert.deepEqual(deleted(), [], 'nothing deleted by a refused request');
});

test('only the ticked groups; stock goes with products, orders with customers', async () => {
  assert.deepEqual(reset.withRequiredGroups(['catalog']), ['catalog', 'inventory']);
  assert.deepEqual(reset.withRequiredGroups(['customers']), ['orders', 'customers']);
  await run({ groups: ['money'] });
  assert.deepEqual(deleted().sort(), ['AdCampaign', 'Expense']);
  calls = [];
  await run({ groups: ['catalog'] });
  const d = deleted();
  assert.ok(d.includes('Product') && d.includes('StockMovement') && d.includes('InventoryUnit'), 'products and their stock');
  assert.ok(!d.includes('Order') && !d.includes('User'), 'orders and customers stay');
  const settings = calls.find((c) => c[0] === 'update' && c[1] === 'Settings');
  assert.deepEqual(settings[2].$set.homeDeals, [], 'home page picks go back to suggestions');
});

test('never staff, categories, brands or coupons; coupon use back to 0; a line in Team history', async () => {
  await run({ groups: ['catalog', 'inventory', 'orders', 'customers', 'money', 'marketing', 'messages', 'history'] });
  const userDelete = calls.find((c) => c[0] === 'delete' && c[1] === 'User');
  assert.deepEqual(userDelete[2], { role: { $nin: ['admin', 'orders', 'catalog', 'support', 'marketing'] } }, 'staff accounts are never deleted');
  for (const kept of [Category.modelName, Brand.modelName, 'Coupon', 'Settings']) assert.ok(!deleted().includes(kept), kept);
  assert.deepEqual(calls.find((c) => c[1] === 'Coupon')[2], { $set: { usedCount: 0 } });
  assert.match(calls.at(-1)[1], /^Emptied the test data \(/, 'logged last, after the history was emptied');
});

test('wired: owner-only route with validation and a tight rate limit; the page panel', () => {
  const routes = fs.readFileSync(path.join(ROOT, 'backend/src/routes/commerce.routes.ts'), 'utf8');
  assert.match(routes, /router\.post\('\/admin\/reset-data', requireAuth, requirePermission\('users:manage'\), resetLimiter, validate\(resetDataSchema\), misc\.resetData\)/);
  assert.match(routes, /const resetLimiter = rateLimit\(\{ windowMs: 15 \* 60 \* 1000, max: 5/);
  const fn = fs.readFileSync(path.join(ROOT, 'api/v1/admin.js'), 'utf8');
  assert.ok(fn.includes("if (route === 'reset-data') {") && fn.includes("requireStaff(req, res, ['users:manage'])"));
  const page = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/admin/Security.tsx'), 'utf8');
  assert.ok(page.includes("{user.role === 'admin' ? <ResetDataPanel /> : null}"));
  const panel = fs.readFileSync(path.join(ROOT, 'frontend/src/components/admin/ResetDataPanel.tsx'), 'utf8');
  assert.ok(panel.includes('const ready = backedUp && password.length > 0'), 'backup tick + password + word before the button works');
});
