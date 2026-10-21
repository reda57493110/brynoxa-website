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
  assert.match(src, /\$set: \{ mfaLastStep: step \}/);
  assert.equal((src.match(/await consumeTotp\(user, code\)/g) || []).length, 2, 'used by sign-in and by turning 2-step off');
});
