// 2-step (TOTP) codes: ±30 s window and each code works only once.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ROOT, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const OTPAuth = require(path.join(ROOT, 'backend/node_modules/otpauth'));
const { totpStep } = require(dist('utils/totp'));
const secret = new OTPAuth.Secret({ size: 20 }).base32;
const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), digits: 6, period: 30, algorithm: 'SHA1' });
const now = Date.now();
const codeAt = (offsetSec) => totp.generate({ timestamp: now + offsetSec * 1000 });

test('current code and one from 30 s ago are accepted; 90 s ago is refused', () => {
  assert.notEqual(totpStep(secret, codeAt(0)), null);
  assert.notEqual(totpStep(secret, codeAt(-30)), null);
  assert.equal(totpStep(secret, codeAt(-90)), null);
  assert.equal(totpStep(secret, 'abcdef'), null);
});

test('sign-in and turning 2-step off use the code up (same or older code refused)', () => {
  const src = require('fs').readFileSync(dist('services/auth.service.js'), 'utf8');
  // the stored step must be lower than the new one, set atomically
  assert.match(src, /mfaLastStep: \{ \$lt: step \}/);
  assert.match(src, /\$set: \{ mfaLastStep: step, mfaClockSkewSteps: newSkew \}/);
  assert.equal((src.match(/await consumeTotp\(user, code\)/g) || []).length, 2, 'used by sign-in and by turning 2-step off');
});

test('turning 2-step on: same QR until "New QR code", and a code from a slightly-off phone clock works', async () => {
  const { User } = require(dist('models/User'));
  const auth = require(dist('services/auth.service'));
  require(dist('models/Settings')).Settings.findOne = async () => ({ emailNotifications: {}, emailMessages: {} });
  const user = new User({ name: 'Owner', email: 'owner@x.com', password: 'x'.repeat(20), role: 'admin' });
  user.save = async function () {
    return this;
  };
  const chain = { select: () => Promise.resolve(user) };
  User.findById = () => chain;

  const first = await auth.setupMfa(String(user._id));
  const again = await auth.setupMfa(String(user._id)); // second tab / second click
  assert.equal(again.secret, first.secret, 'opening setup again keeps the same QR code');
  const fresh = await auth.setupMfa(String(user._id), { rotate: true }); // "New QR code"
  assert.notEqual(fresh.secret, first.secret, '"New QR code" gives a new one');

  const app = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(fresh.secret), digits: 6, period: 30, algorithm: 'SHA1' });
  // phone clock 50 s behind
  const code = app.generate({ timestamp: Date.now() - 50_000 });
  const result = await auth.verifyMfaSetup(String(user._id), code);
  assert.equal(result.recoveryCodes.length, 10);
  assert.equal(user.mfaEnabled, true);
});

test('a really old code (3 minutes) is still refused', () => {
  assert.equal(totpStep(secret, codeAt(-180)), null);
});

test("a phone whose clock is a few minutes off: setup learns the difference; too far is explained", async () => {
  const { User } = require(dist('models/User'));
  const auth = require(dist('services/auth.service'));
  const { totpStep: stepWithSkew } = require(dist('utils/totp'));
  const user = new User({ name: 'Owner', email: 'owner2@x.com', password: 'x'.repeat(20), role: 'admin' });
  user.save = async function () {
    return this;
  };
  User.findById = () => ({ select: () => Promise.resolve(user) });
  const { secret: s } = await auth.setupMfa(String(user._id), { rotate: true });
  const phone = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(s), digits: 6, period: 30, algorithm: 'SHA1' });

  // 15 minutes off: refused with the clock message
  await assert.rejects(auth.verifyMfaSetup(String(user._id), phone.generate({ timestamp: Date.now() - 15 * 60000 }), s), /phone's time is about 15 minutes behind/);
  // 2 minutes slow: accepted, difference remembered (-4 steps)
  await auth.verifyMfaSetup(String(user._id), phone.generate({ timestamp: Date.now() - 120000 }), s);
  assert.equal(user.mfaEnabled, true);
  assert.ok(user.mfaClockSkewSteps <= -3 && user.mfaClockSkewSteps >= -5, String(user.mfaClockSkewSteps));
  // later codes from the same slow phone are valid around the remembered difference
  assert.notEqual(stepWithSkew(s, phone.generate({ timestamp: Date.now() - 90000 }), user.mfaClockSkewSteps), null);
  assert.equal(stepWithSkew(s, phone.generate({ timestamp: Date.now() - 90000 }), 0), null, 'without the difference it would fail');
});
