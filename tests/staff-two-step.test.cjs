// 2-step sign-in is required for staff (after a 7-day grace period), and code guessing is limited.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { dist, api, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const policy = require(dist('utils/mfaPolicy'));
const DAY = 86_400_000;

test('only the owner must turn on 2-step (7 days); other staff and customers never', () => {
  const now = Date.now();
  const fresh = { role: 'admin', mfaEnabled: false, mfaGraceUntil: new Date(now + 3 * DAY) };
  assert.equal(policy.mfaSetupOverdue(fresh, now), false);
  assert.equal(policy.mfaSetupOverdue({ ...fresh, mfaGraceUntil: new Date(now - DAY) }, now), true);
  assert.equal(policy.mfaSetupOverdue({ ...fresh, mfaEnabled: true, mfaGraceUntil: new Date(now - DAY) }, now), false, '2-step on');
  // Staff accounts are managed by the owner: never asked
  assert.equal(policy.mfaSetupOverdue({ role: 'orders', mfaEnabled: false, mfaGraceUntil: new Date(now - DAY) }, now), false);
  assert.equal(policy.mfaSetupDeadline({ role: 'support', mfaEnabled: false }), null);
  assert.equal(policy.mfaSetupOverdue({ role: 'customer', mfaEnabled: false }, now), false, 'customers');
  const start = policy.MFA_RULE_START.getTime();
  assert.equal(policy.mfaSetupOverdue({ role: 'admin', mfaEnabled: false }, start + 6 * DAY), false);
  assert.equal(policy.mfaSetupOverdue({ role: 'admin', mfaEnabled: false }, start + 8 * DAY), true);
  assert.ok(Math.abs(policy.newMfaGraceUntil(now).getTime() - (now + 7 * DAY)) < 1000);
});

test('server functions: staff pages check it, the 2-step setup page stays open', () => {
  const auth = fs.readFileSync(api('_lib/auth.js'), 'utf8');
  assert.match(auth, /if \(!allowWithoutMfa && policy\.mfaSetupOverdue\(user\)\)/);
  const mfa = fs.readFileSync(api('_lib/auth-routes/mfa.js'), 'utf8');
  assert.match(mfa, /requireStaff\(req, res, \[\], \{ allowWithoutMfa: true \}\)/);
  // Express: staff checks refuse, the setup routes use the role-only check
  const mw = fs.readFileSync(dist('middleware/auth.js'), 'utf8');
  assert.equal((mw.match(/if \(req\.user\.mfaOverdue\)\s+return next\(mfaRequired\(\)\)/g) || []).length, 2);
  const routes = fs.readFileSync(dist('routes/auth.routes.js'), 'utf8');
  assert.match(routes, /mfa\/setup', auth_1\.requireAuth, auth_1\.requireStaffRole/);
});

test('new and promoted staff get their own grace period', () => {
  const src = fs.readFileSync(dist('services/admin.service.js'), 'utf8');
  assert.equal((src.match(/mfaGraceUntil = \(0, mfaPolicy_1\.newMfaGraceUntil\)\(\)|mfaGraceUntil: \(0, mfaPolicy_1\.newMfaGraceUntil\)\(\)/g) || []).length, 3);
});

test('code guessing: wrong tries counted atomically; limits per account and per sign-in', () => {
  const svc = fs.readFileSync(dist('services/auth.service.js'), 'utf8');
  assert.match(svc, /findOneAndUpdate\(\{ _id: user\._id \}, \{ \$inc: \{ failedLoginAttempts: 1 \} \}/);
  const account = fs.readFileSync(api('_lib/auth-routes/account.js'), 'utf8');
  assert.match(account, /rateLimit\(req, res, 'mfaChallenge', challenge, \{ perIp: false \}\)/);
  assert.match(account, /perKey = claimed && typeof claimed\.userId === 'string'/);
  const login = fs.readFileSync(api('_lib/auth-routes/login.js'), 'utf8');
  assert.match(login, /rateLimit\(req, res, 'login', email\)/);
  const { LIMITS } = require(api('_lib/rateLimit.js'));
  assert.equal(LIMITS.mfaChallenge.max, 5);
});
