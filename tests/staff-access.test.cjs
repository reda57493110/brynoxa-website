// What each staff role can see or change: dashboard data, purchase costs, payment details.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { hasPermission } = require(dist('permissions'));
const { dashboardStatsFor } = require(dist('services/admin.service'));
const { hideCostsFor } = require(dist('utils/hideCosts'));

test('only the owner can change the deposit payment details; order staff can still read them', () => {
  for (const role of ['orders', 'support', 'catalog', 'marketing', 'customer']) assert.equal(hasPermission(role, 'settings'), false, role);
  assert.ok(hasPermission('admin', 'settings'));
  assert.ok(hasPermission('orders', 'orders:read') && hasPermission('support', 'orders:read'));
  // The exact save route in the compiled server
  const routes = fs.readFileSync(require.resolve(dist('routes/commerce.routes')), 'utf8');
  const saveRoute = routes.split('\n').find((l) => l.startsWith("router.put('/admin/deposit-methods'"));
  assert.ok(saveRoute, 'save route exists');
  assert.match(saveRoute, /requirePermission\)\('settings'\)/);
});

test('the dashboard summary only contains what each role can open', () => {
  const full = { todayOrders: 3, todayOrderValue: 9800, orderCount: 120, pendingOrders: 4, attentionOrders: 2, customerCount: 85, productCount: 40, activeProducts: 38, lowStock: 3, outOfStock: 1, reviewCount: 7, unreadMessages: 5, recentOrders: [{ orderNumber: 'BRX-1' }], ordersByStatus: { pending: 4 }, lowStockProducts: [{ name: 'HP' }] };
  const f = (role) => dashboardStatsFor(full, role);
  assert.equal(f('admin').todayOrderValue, 9800);
  assert.equal(f('orders').pendingOrders, 4);
  assert.equal(f('orders').lowStock, 0);
  assert.equal(f('support').unreadMessages, 5);
  assert.equal(f('catalog').lowStock, 3);
  assert.equal(f('catalog').todayOrderValue, 0);
  assert.equal(f('catalog').recentOrders.length, 0);
  assert.equal(f('marketing').customerCount, 0);
  for (const r of ['admin', 'orders', 'support', 'catalog', 'marketing']) assert.equal(Object.keys(f(r)).length, Object.keys(full).length, r);
});

test('purchase costs are hidden from order/support staff, kept for owner and catalog', () => {
  const order = { items: [{ name: 'HP', price: 3600, qty: 1, unitCost: 2800 }], pricing: { total: 3640 }, refunds: [{ amount: 100 }], costs: { delivery: 35 } };
  for (const role of ['orders', 'support']) {
    const o = hideCostsFor(role, order);
    assert.doesNotMatch(JSON.stringify(o), /2800|unitCost/);
    assert.equal('costs' in o, false);
    assert.equal(o.items[0].price, 3600);
    assert.equal(o.refunds[0].amount, 100);
  }
  for (const role of ['admin', 'catalog']) assert.equal(hideCostsFor(role, order).items[0].unitCost, 2800);
});

test('new staff account replies never include the password; CSV export guards formulas', () => {
  assert.match(fs.readFileSync(dist('services/admin.service.js'), 'utf8'), /const fresh = await (User_1\.)?User\.findById\(user\._id\);\s+return \{ user: fresh, verificationSent \}/);
  assert.ok(fs.readFileSync(dist('services/customerAnalytics.service.js'), 'utf8').includes(String.raw`/^[=+\-@\t\r]/`));
});
