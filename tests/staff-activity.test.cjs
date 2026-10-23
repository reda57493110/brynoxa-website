// Staff activity (Admin → Roles): successful staff changes are logged with a readable line; reads,
// failures and noise are not; only the owner can see it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { EventEmitter } = require('events');
const { api, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { describeStaffAction, logicalApiPath } = require(dist('utils/staffActions'));
const { StaffAction } = require(dist('models/StaffAction'));
const activity = require(dist('services/staffActivity.service'));

const ID = '64e000000000000000000001';

test('readable lines, with what was changed', () => {
  assert.deepEqual(describeStaffAction('PATCH', `admin/orders/${ID}/status`), { action: 'Changed an order status', kind: 'order-status', targetId: ID });
  assert.equal(describeStaffAction('POST', 'admin/orders').action, 'Added an order');
  assert.equal(describeStaffAction('DELETE', `admin/products/${ID}`).action, 'Deleted a product');
  assert.equal(describeStaffAction('PATCH', `admin/products/${ID}`).action, 'Edited a product');
  assert.equal(describeStaffAction('POST', 'admin/inventory/receipts').action, 'Received stock from a supplier');
  assert.equal(describeStaffAction('POST', 'admin/coupons').action, 'Added a coupon');
  assert.equal(describeStaffAction('GET', 'admin/orders'), null, 'reads are not logged');
  assert.equal(describeStaffAction('POST', 'admin/upload'), null, 'photo uploads are noise');
});

test('the real address behind the Vercel rewrites', () => {
  assert.equal(logicalApiPath(`/api/v1/admin?__route=orders/${ID}/status`), `admin/orders/${ID}/status`);
  assert.equal(logicalApiPath('/api/v1/categories?__resource=brands&__route=abc'), 'brands/abc');
  assert.equal(logicalApiPath('/api?__path=admin/inventory/receipts&x=1'), 'admin/inventory/receipts');
  assert.equal(logicalApiPath('/api/v1/admin/coupons'), 'admin/coupons');
});

test('written only once the change succeeded, and once per request', async () => {
  const saved = [];
  StaffAction.create = async (doc) => saved.push(doc);
  const run = async (status, method = 'PATCH') => {
    const req = { method, url: `/api/v1/admin?__route=products/${ID}` };
    const res = new EventEmitter();
    res.statusCode = status;
    activity.trackStaffRequest(req, res, { id: 'staff1', role: 'catalog' });
    activity.trackStaffRequest(req, res, { id: 'staff1', role: 'catalog' });
    res.writableFinished = true;
    res.emit('finish');
    await new Promise((r) => setImmediate(r));
  };
  await run(200);
  await run(403);
  await run(200, 'GET');
  assert.equal(saved.length, 1);
  assert.equal(saved[0].action, 'Edited a product');
  assert.equal(saved[0].targetId, ID);
  assert.equal(saved[0].user, 'staff1');
});

test('both servers hook the staff checks; the activity pages are owner-only', () => {
  const auth = fs.readFileSync(api('_lib/auth.js'), 'utf8');
  assert.match(auth, /trackStaffRequest\(req, res, \{ id: String\(user\._id\), role: user\.role \}\)/);
  const mw = fs.readFileSync(dist('middleware/auth.js'), 'utf8');
  assert.equal((mw.match(/trackStaffRequest\)\(req, res, \{ id: req\.user\.userId, role: req\.user\.role \}\)/g) || []).length, 2);
  const admin = fs.readFileSync(api('v1/admin.js'), 'utf8');
  assert.match(admin, /activityMatch && req\.method === 'GET'\) \{\s+const user = await requireStaff\(req, res, \['users:manage'\]\);/);
  const routes = fs.readFileSync(dist('routes/commerce.routes.js'), 'utf8');
  assert.equal((routes.match(/team-activity[^']*', auth_1\.requireAuth, \(0, auth_1\.requirePermission\)\('users:manage'\)/g) || []).length, 2);
  assert.equal(activity.periodDays('9999'), 30);
});
