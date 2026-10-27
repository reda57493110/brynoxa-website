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

test('re-adding a removed staff member: the page is told it is an existing account', async () => {
  User.findOne = () => ({ select: async () => ({ email: 'old@x.com', role: 'customer', isGuest: false }) });
  await assert.rejects(admin.createStaffUser({ email: 'old@x.com', password: 'Long-Strong-Pass-2026', role: 'orders' }), (err) => err.statusCode === 409 && err.code === 'EXISTING_ACCOUNT');
  User.findOne = () => ({ select: async () => ({ email: 's@x.com', role: 'orders', isGuest: false }) });
  await assert.rejects(admin.createStaffUser({ email: 's@x.com', password: 'Long-Strong-Pass-2026', role: 'orders' }), /already a staff member/);
});

test('staff passwords are the owner\'s business: staff cannot change or reset their own', () => {
  const svc = fs.readFileSync(dist('services/auth.service.js'), 'utf8');
  // change-password and the reset link both refuse staff other than the owner
  assert.equal((svc.match(/assertOwnPasswordAllowed\(user\.role\);/g) || []).length, 2);
  assert.match(svc, /if \(\(0, permissions_1\.isStaffRole\)\(user\.role\) && user\.role !== 'admin'\)\s+return;/);
  assert.match(svc, /2-step sign-in is for the owner account/);
  const routes = fs.readFileSync(dist('routes/commerce.routes.js'), 'utf8');
  assert.match(routes, /'\/admin\/users\/:id\/password', auth_1\.requireAuth, \(0, auth_1\.requirePermission\)\('users:manage'\), \(0, validate_1\.validate\)\(schemas_1\.staffPasswordSchema\)/);
});

test('the owner sets a staff password: signed out everywhere; never the owner account', async () => {
  let saved = false;
  target = { _id: ID, role: 'orders', save: async () => { saved = true; }, refreshToken: 'r' };
  await admin.setStaffPassword(ID, 'Long-Strong-Pass-2026');
  assert.equal(target.password, 'Long-Strong-Pass-2026');
  assert.equal(target.refreshToken, undefined);
  assert.ok(target.passwordChangedAt instanceof Date);
  assert.ok(saved);
  target = { _id: ID, role: 'admin', save: async () => {} };
  await assert.rejects(admin.setStaffPassword(ID, 'Long-Strong-Pass-2026'), /owner password/);
});
