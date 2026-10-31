// Admin → customer → "Password reset link": a customer who forgot their password writes on WhatsApp;
// the owner makes a one-time link (24 h) and sends it, the customer chooses the new password.
// - customers only (never a staff account), not for a disabled account;
// - only the owner (customers:write), logged in the staff activity;
// - on the live site the request reaches the server code through api/v1/admin.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { User } = require(dist('models/User.js'));
const auth = require(dist('services/auth.service.js'));

const ID = 'a'.repeat(24);
function fakeUser(over = {}) {
  const u = { _id: ID, name: 'Ahmed Benali', phone: '0612345678', role: 'customer', isActive: true, saved: 0, ...over };
  u.save = async () => {
    u.saved++;
  };
  return u;
}
const found = (u) => ({ select: () => Promise.resolve(u) });

test('a customer gets a one-time link valid 24 hours; only its fingerprint is stored', async () => {
  const u = fakeUser();
  User.findById = () => found(u);
  const before = Date.now();
  const r = await auth.createPasswordLinkForCustomer(ID);
  const token = /^https:\/\/shop\.test\/reset-password\?token=([a-f0-9]{64})$/.exec(r.link)[1];
  assert.equal(u.passwordResetTokenHash, createHash('sha256').update(token).digest('hex'));
  assert.notEqual(u.passwordResetTokenHash, token);
  const ttl = u.passwordResetExpires.getTime() - before;
  assert.ok(ttl >= 24 * 3600e3 - 1000 && ttl <= 24 * 3600e3 + 1000, `24 h, got ${ttl}`);
  assert.equal(r.name, 'Ahmed Benali');
  assert.equal(r.phone, '0612345678');
  assert.equal(u.saved, 1);
  // A second link replaces the first
  const r2 = await auth.createPasswordLinkForCustomer(ID);
  assert.notEqual(r2.link, r.link);
});

test('refused: staff accounts, disabled accounts, unknown or invalid ids', async () => {
  for (const role of ['owner', 'admin', 'orders', 'catalog']) {
    const u = fakeUser({ role });
    User.findById = () => found(u);
    await assert.rejects(auth.createPasswordLinkForCustomer(ID), (e) => e.statusCode === 404);
    assert.equal(u.saved, 0);
  }
  const off = fakeUser({ isActive: false });
  User.findById = () => found(off);
  await assert.rejects(auth.createPasswordLinkForCustomer(ID), /disabled/);
  assert.equal(off.saved, 0);
  User.findById = () => found(null);
  await assert.rejects(auth.createPasswordLinkForCustomer(ID), (e) => e.statusCode === 404);
  await assert.rejects(auth.createPasswordLinkForCustomer('nope'), (e) => e.statusCode === 404);
});

test('route for the owner only, logged in staff activity, button on the customer page', () => {
  assert.match(
    fs.readFileSync(dist('routes/customer.routes.js'), 'utf8'),
    /router\.post\('\/admin\/customers\/:id\/password-link', auth_1\.requireAuth, \(0, auth_1\.requirePermission\)\('customers:write'\)/
  );
  const { describeStaffAction } = require(dist('utils/staffActions.js'));
  assert.deepEqual(describeStaffAction('POST', `admin/customers/${ID}/password-link`), {
    action: 'Made a password reset link for a customer',
    kind: 'customer',
    targetId: ID,
  });
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  assert.match(src('pages/admin/CustomerProfile.tsx'), /<PasswordLinkDialog/);
  assert.match(src('api/adminApi.ts'), /\/admin\/customers\/\$\{id\}\/password-link/);
});

test('on the live site the request reaches the server code (not "Method not allowed")', async () => {
  const { fakeModule } = require('./_helpers.cjs');
  const handled = [];
  fakeModule(dist('app.js'), {
    getApp: () => (req, res) => {
      handled.push(req.url);
      res.statusCode = 200;
      res.end('{"success":true}');
    },
  });
  fakeModule(api('_lib/mongo.js'), { connectMongo: async () => ({}) });
  const admin = require(api('v1/admin.js'));
  const listeners = {};
  const res = { statusCode: 0, headers: {}, setHeader() {}, on(ev, fn) { listeners[ev] = fn; }, end(b) { this.body = b; listeners.finish && listeners.finish(); } };
  const route = `customers/${ID}/password-link`;
  await admin({ method: 'POST', url: `/api/v1/admin?__route=${route}`, query: { __route: route }, headers: {}, socket: {} }, res);
  assert.deepEqual(handled, [`/api/v1/admin/${route}`]);
  assert.equal(res.statusCode, 200);
});
