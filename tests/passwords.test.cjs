// Published / common passwords can never be set (security fix #4).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { isBlockedPassword } = require(dist('utils/blockedPasswords'));
const s = require(dist('validators/schemas'));
const oldDefault = ['Admin', '123', '!'].join('');

test('the old published admin password and common passwords are blocked (any capitals/spaces)', () => {
  assert.ok(isBlockedPassword(oldDefault));
  assert.ok(isBlockedPassword(' ADMIN123! '));
  for (const p of ['123456', 'azerty', 'Password', 'administrator']) assert.ok(isBlockedPassword(p), p);
  assert.equal(isBlockedPassword('Tajine-Rabat-2026'), false);
});

test('sign-up, password change and reset refuse them with a clear message', () => {
  assert.equal(s.registerSchema.safeParse({ name: 'Ali', email: 'a@x.com', password: oldDefault }).success, false);
  assert.equal(s.changePasswordSchema.safeParse({ currentPassword: 'x', newPassword: oldDefault }).success, false);
  assert.equal(s.resetPasswordSchema.safeParse({ token: 'a'.repeat(64), newPassword: oldDefault }).success, false);
  const msg = s.registerSchema.safeParse({ name: 'Ali', email: 'a@x.com', password: '123456' }).error.issues[0].message;
  assert.match(msg, /too common or was published/);
  assert.ok(s.registerSchema.safeParse({ name: 'Ali', email: 'a@x.com', password: 'Tajine-Rabat-2026' }).success);
});

test('new staff accounts refuse a long but common password and accept a strong one', () => {
  assert.equal(s.createStaffUserSchema.safeParse({ email: 's@x.com', password: 'administrator', role: 'orders' }).success, false);
  assert.ok(s.createStaffUserSchema.safeParse({ email: 's@x.com', password: 'Long-Strong-Pass-2026', role: 'orders' }).success);
});
