// A staff member who did not get the verification email is not locked out: the owner can resend
// it or mark the address verified; without a working email sender new staff start verified.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { User } = require(dist('models/User'));
const admin = require(dist('services/admin.service'));

const ID = '64f000000000000000000001';
let target;
User.findById = async (id) => (id === ID ? target : null);

test('mark as verified: the staff member can sign in', async () => {
  let saved = false;
  target = { _id: ID, role: 'orders', email: 's@x.com', emailVerified: false, emailVerificationTokenHash: 'h', save: async () => { saved = true; } };
  await admin.verifyStaffEmail(ID, 'mark');
  assert.equal(target.emailVerified, true);
  assert.equal(target.emailVerificationTokenHash, undefined);
  assert.ok(saved);
});

test('resend without a working email sender says what to do instead', async () => {
  target = { _id: ID, role: 'orders', email: 's@x.com', emailVerified: false, save: async () => {} };
  await assert.rejects(admin.verifyStaffEmail(ID, 'resend'), /Mark as verified/);
});

test('customers and unknown accounts are refused', async () => {
  target = { _id: ID, role: 'customer', emailVerified: false };
  await assert.rejects(admin.verifyStaffEmail(ID, 'mark'), /Staff member not found/);
  await assert.rejects(admin.verifyStaffEmail('nope', 'mark'), /not found/);
});

test('owner only; new staff are only asked to verify when emails can really be sent', () => {
  const routes = fs.readFileSync(dist('routes/commerce.routes.js'), 'utf8');
  assert.match(routes, /'\/admin\/users\/:id\/verify-email', auth_1\.requireAuth, \(0, auth_1\.requirePermission\)\('users:manage'\)/);
  const svc = fs.readFileSync(dist('services/admin.service.js'), 'utf8');
  assert.match(svc, /askToVerify = env_1\.isProd && \(0, env_1\.isEmailConfigured\)\(\)/);
});
