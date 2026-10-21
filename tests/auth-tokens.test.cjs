// Sign-in tokens: the "enter your 2-step code" token must never work as a login (security fix #1),
// and tokens issued before a password change are refused.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { ROOT, dist, api, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const path = require('path');
const t = require(dist('utils/tokens'));
const jwt = require(path.join(ROOT, 'backend/node_modules/jsonwebtoken'));
const { issuedBeforePasswordChange } = require(dist('utils/tokenFreshness'));

const verifies = (fn) => {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
};

// api/_lib/auth.js keeps its check private; load the function as written in the file
const src = fs.readFileSync(api('_lib/auth.js'), 'utf8');
const fnSrc = src.slice(src.indexOf('function verifyAccessJwt'), src.indexOf('async function loadUserFromAuthHeader'));
const verifyAccessJwt = new Function('jwt', 'process', fnSrc + '; return verifyAccessJwt')(jwt, process);

const access = t.signAccessToken({ userId: 'u1', role: 'admin' });
const mfa = t.signMfaChallenge('u1');
const liveMfa = jwt.sign({ userId: 'u1', purpose: 'mfa' }, `${process.env.JWT_ACCESS_SECRET}:mfa-challenge`, { expiresIn: '5m' });
const oldStyleMfa = jwt.sign({ userId: 'u1', purpose: 'mfa' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '5m' });

test('a normal login token works (server and live API)', () => {
  assert.ok(verifies(() => t.verifyAccessToken(access)));
  assert.ok(verifies(() => verifyAccessJwt(access)));
});

test('the 2-step challenge token is refused as a login', () => {
  assert.equal(verifies(() => t.verifyAccessToken(mfa)), false);
  assert.equal(verifies(() => t.verifyAccessToken(oldStyleMfa)), false);
  assert.equal(verifies(() => verifyAccessJwt(liveMfa)), false);
  assert.equal(verifies(() => verifyAccessJwt(oldStyleMfa)), false);
});

test('the challenge token still works for the code step, a login token does not', () => {
  assert.ok(verifies(() => t.verifyMfaChallenge(mfa)));
  assert.ok(verifies(() => t.verifyMfaChallenge(liveMfa)));
  assert.equal(verifies(() => t.verifyMfaChallenge(access)), false);
});

test('a refresh token is refused as a login', () => {
  assert.equal(verifies(() => verifyAccessJwt(t.signRefreshToken({ userId: 'u1', role: 'admin' }))), false);
});

test('tokens issued before a password change are refused', () => {
  const now = Math.floor(Date.now() / 1000);
  assert.ok(issuedBeforePasswordChange({ iat: now - 600 }, { passwordChangedAt: new Date() }));
  assert.equal(issuedBeforePasswordChange({ iat: now + 1 }, { passwordChangedAt: new Date(Date.now() - 1000) }), false);
  assert.equal(issuedBeforePasswordChange({ iat: now - 99999 }, {}), false);
});
