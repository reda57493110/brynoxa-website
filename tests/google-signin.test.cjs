// "Continue with Google": the token from Google's button is checked with Google's public keys
// (signature, our client ID, issuer, expiry, verified email); a new email gets an account, a guest
// becomes a full account, a customer signs in; staff are refused (they keep password + code).
// Google's key list is faked here (no network).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { generateKeyPairSync } = require('crypto');
const { ROOT, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv({ VITE_GOOGLE_CLIENT_ID: 'shop-client.apps.googleusercontent.com' });

const jwt = require(path.join(ROOT, 'backend/node_modules/jsonwebtoken'));
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
global.fetch = async (url) => {
  assert.equal(String(url), 'https://www.googleapis.com/oauth2/v3/certs');
  return { ok: true, json: async () => ({ keys: [jwk] }), headers: { get: () => 'public, max-age=3600' } };
};
const token = (claims = {}, opts = {}) =>
  jwt.sign(
    { email: 'Sara@Gmail.com', email_verified: true, name: 'Sara Alaoui', sub: '123', ...claims },
    opts.key || privateKey,
    { algorithm: opts.alg || 'RS256', keyid: opts.kid || 'k1', audience: opts.aud || 'shop-client.apps.googleusercontent.com', issuer: opts.iss || 'https://accounts.google.com', expiresIn: opts.exp || '5m' }
  );

const { User } = require(dist('models/User'));
const db = [];
const chain = (r) => ({ select: () => chain(r), then: (a, b) => Promise.resolve(r).then(a, b) });
User.findOne = (q) => chain(db.find((u) => u.email === q.email) || null);
User.create = async (o) => {
  const u = new User(o);
  db.push(u);
  return u;
};
User.prototype.save = async function () {
  return this;
};

const google = require(dist('services/googleAuth.service'));
const auth = require(dist('services/auth.service'));

test('a real Google token is accepted; the email comes lower-case', async () => {
  const p = await google.verifyGoogleCredential(token())
  assert.deepEqual(p, { email: 'sara@gmail.com', name: 'Sara Alaoui', sub: '123' })
})

test('made-up or wrong tokens are refused', async () => {
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey
  const refused = async (t, why) => {
    await assert.rejects(google.verifyGoogleCredential(t), (e) => e.statusCode === 401, why)
  }
  await refused(token({}, { key: other }), 'signed by someone else')
  await refused(token({}, { aud: 'another-site.apps.googleusercontent.com' }), 'made for another site')
  await refused(token({}, { iss: 'https://evil.example' }), 'not from Google')
  await refused(token({}, { exp: -10 }), 'expired')
  await refused(token({ email_verified: false }), 'email not verified by Google')
  await refused(jwt.sign({ email: 'a@b.c', email_verified: true }, 'secret', { algorithm: 'HS256', keyid: 'k1', audience: 'shop-client.apps.googleusercontent.com', issuer: 'accounts.google.com' }), 'not RSA')
  await refused('not-a-token-at-all-xxxxxxxx', 'garbage')
})

test('the shop and the server use the same built-in client ID; a Vercel variable "off" turns it off', async () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
  const id = google.BRYNOXA_GOOGLE_CLIENT_ID
  assert.match(id, /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/)
  assert.ok(read('frontend/src/components/auth/GoogleSignIn.tsx').includes(`const BRYNOXA_GOOGLE_CLIENT_ID = '${id}'`), 'same ID on both sides')
  const saved = process.env.VITE_GOOGLE_CLIENT_ID
  process.env.VITE_GOOGLE_CLIENT_ID = ''
  assert.equal(google.googleClientId(), id, 'no variable: the built-in ID')
  process.env.VITE_GOOGLE_CLIENT_ID = 'off'
  try {
    await assert.rejects(google.verifyGoogleCredential(token()), (e) => e.statusCode === 503)
  } finally {
    process.env.VITE_GOOGLE_CLIENT_ID = saved
  }
})

test('new email: an account at once, signed in', async () => {
  const r = await auth.signInWithGoogle(token({ email: 'new@gmail.com', name: 'Youssef' }))
  assert.ok(r.accessToken && r.refreshToken)
  const u = db.find((x) => x.email === 'new@gmail.com')
  assert.equal(u.isGuest, false)
  assert.equal(u.emailVerified, true)
  assert.equal(u.name, 'Youssef')
  assert.ok(u.password.length >= 30, 'a long random password it never needs')
})

test('a guest who ordered with this email becomes a full account; a customer just signs in', async () => {
  db.push(new User({ name: 'Guest', email: 'guest@gmail.com', password: 'x'.repeat(20), isGuest: true, emailVerified: false }))
  await auth.signInWithGoogle(token({ email: 'guest@gmail.com' }))
  const g = db.find((x) => x.email === 'guest@gmail.com')
  assert.equal(g.isGuest, false)
  assert.equal(g.emailVerified, true)
  const before = db.length
  const r = await auth.signInWithGoogle(token({ email: 'guest@gmail.com' }))
  assert.equal(db.length, before, 'no second account')
  assert.equal(r.user.email, 'guest@gmail.com')
})

test('staff and disabled accounts are refused', async () => {
  db.push(new User({ name: 'Owner', email: 'owner@gmail.com', password: 'x'.repeat(20), role: 'admin' }))
  await assert.rejects(auth.signInWithGoogle(token({ email: 'owner@gmail.com' })), (e) => e.statusCode === 403)
  db.push(new User({ name: 'Off', email: 'off@gmail.com', password: 'x'.repeat(20), isActive: false }))
  await assert.rejects(auth.signInWithGoogle(token({ email: 'off@gmail.com' })), (e) => e.statusCode === 403)
})

test('wired everywhere: Express route, Vercel function and address, security headers, the shop button', () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
  assert.match(read('backend/src/routes/auth.routes.ts'), /router\.post\('\/google', authLimiter, validate\(googleSignInSchema\), auth\.googleSignIn\)/)
  assert.match(read('api/v1/auth.js'), /google: \(\) => require\('\.\.\/_lib\/auth-routes\/google'\)/)
  assert.match(read('api/_lib/auth-routes/google.js'), /rateLimit\(req, res, 'login'\)/, 'same limit as password sign-in')
  assert.match(read('api/_lib/auth-routes/google.js'), /parseBody\(schemas\.googleSignInSchema, body\)/, 'same check as Express')
  const vercel = read('vercel.json')
  assert.match(vercel, /"\/api\/v1\/auth\/\(login\|google\|/)
  assert.match(vercel, /script-src [^;]*https:\/\/accounts\.google\.com\/gsi\/client/)
  assert.match(vercel, /frame-src https:\/\/accounts\.google\.com\/gsi\//)
  assert.match(vercel, /connect-src [^;]*https:\/\/accounts\.google\.com\/gsi\//)
  const btn = read('frontend/src/components/auth/GoogleSignIn.tsx')
  assert.match(btn, /if \(!GOOGLE_CLIENT_ID\) return null/, 'no client ID: no button')
  assert.match(btn, /text: 'continue_with'/)
  for (const p of ['Login', 'Register', 'Checkout']) assert.match(read(`frontend/src/pages/store/${p}.tsx`), /<GoogleSignIn/, p)
  // Checkout: signed in with Google, the order goes on there (name filled in when empty)
  assert.match(read('frontend/src/pages/store/Checkout.tsx'), /setAddress\(\(a\) => \(\{ \.\.\.a, fullName: a\.fullName \|\| u\.name \}\)\)/)
})
