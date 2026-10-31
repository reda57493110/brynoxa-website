// Forgot password with a 6-digit code: the email carries a code (and the old link); the customer
// types the code on the site, then chooses a new password.
// - code valid 15 minutes, used once, 5 wrong tries cancel it, a new email replaces it;
// - only a fingerprint is stored; unknown email / wrong / expired code get the same answer;
// - on the live site the request reaches the code through api/v1/auth.js.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, dist, api, setTestEnv } = require('./_helpers.cjs');
setTestEnv({ RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'Shop <a@shop.test>' });

const emailSvc = require(dist('services/email.service'));
const sent = [];
emailSvc.sendEmail = async (m) => {
  sent.push(m);
  return true;
};
require(dist('models/Settings')).Settings.findOne = async () => ({ emailNotifications: {}, emailMessages: {} });
const { User } = require(dist('models/User'));
const bcrypt = require(path.join(ROOT, 'backend/node_modules/bcryptjs'));

const db = [];
const chain = (r) => ({ select: () => chain(r), then: (a, b) => Promise.resolve(r).then(a, b) });
const match = (u, q) =>
  Object.entries(q).every(([k, v]) => {
    const val = u.get(k);
    if (v && typeof v === 'object' && '$gt' in v) return val && val > v.$gt;
    return String(val) === String(v);
  });
User.findOne = (q) => chain(db.find((u) => match(u, q)) || null);
User.findById = (id) => chain(db.find((u) => String(u._id) === String(id)) || null);
User.updateOne = async () => ({ modifiedCount: 1 });
User.prototype.save = async function () {
  if (this.isModified('password') && !String(this.password).startsWith('$2')) this.password = await bcrypt.hash(this.password, 4);
  return this;
};
const ahmed = new User({ name: 'Ahmed Benali', email: 'ahmed@x.com', password: 'OldPassword123', role: 'customer' });
db.push(ahmed);

const auth = require(dist('services/auth.service'));

async function emailedCode() {
  sent.length = 0;
  await auth.requestPasswordReset('Ahmed@X.com');
  const mail = sent.find((m) => m.to === 'ahmed@x.com');
  assert.ok(mail, 'email sent');
  const code = /letter-spacing:8px[^>]*>(\d{6})</.exec(mail.html)[1];
  return { mail, code };
}
const wrongOf = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

test('the email has a 6-digit code and the link; only a fingerprint of the code is stored', async () => {
  const { mail, code } = await emailedCode();
  assert.match(mail.html, /reset-password\?token=[a-f0-9]{64}/);
  assert.match(mail.text, new RegExp(code));
  assert.match(mail.html, /valid 15 minutes/);
  assert.ok(ahmed.passwordResetCodeHash && !ahmed.passwordResetCodeHash.includes(code));
  const ttl = ahmed.passwordResetCodeExpires.getTime() - Date.now();
  assert.ok(ttl > 14 * 60e3 && ttl <= 15 * 60e3);
});

test('the right code opens the new-password step once; the password changes; the code is used up', async () => {
  const { code } = await emailedCode();
  const { token } = await auth.verifyPasswordResetCode('ahmed@x.com', `${code.slice(0, 3)} ${code.slice(3)}`);
  assert.match(token, /^[a-f0-9]{64}$/);
  await assert.rejects(auth.verifyPasswordResetCode('ahmed@x.com', code), /wrong or has expired/, 'used once');
  await auth.resetPassword(token, 'BrandNew-Pass-2026');
  assert.ok(await bcrypt.compare('BrandNew-Pass-2026', ahmed.password));
  await assert.rejects(auth.resetPassword(token, 'Another-Pass-2026'), /invalid or expired/);
});

test('5 wrong tries cancel the code; unknown email and expired code get the same answer', async () => {
  const { code } = await emailedCode();
  for (let i = 0; i < 5; i++) {
    await assert.rejects(auth.verifyPasswordResetCode('ahmed@x.com', wrongOf(code)), /wrong or has expired/);
  }
  await assert.rejects(auth.verifyPasswordResetCode('ahmed@x.com', code), /wrong or has expired/, 'cancelled after 5 wrong tries');
  await assert.rejects(auth.verifyPasswordResetCode('nobody@x.com', code), /wrong or has expired/);
  const again = await emailedCode();
  ahmed.passwordResetCodeExpires = new Date(Date.now() - 1000);
  await assert.rejects(auth.verifyPasswordResetCode('ahmed@x.com', again.code), /wrong or has expired/);
});

test('a new email replaces the previous code', async () => {
  const first = await emailedCode();
  let second = await emailedCode();
  while (second.code === first.code) second = await emailedCode();
  await assert.rejects(auth.verifyPasswordResetCode('ahmed@x.com', first.code), /wrong or has expired/);
  assert.ok((await auth.verifyPasswordResetCode('ahmed@x.com', second.code)).token);
});

test('the form only accepts 6 digits (spaces allowed)', () => {
  const { resetCodeSchema } = require(dist('validators/schemas'));
  assert.equal(resetCodeSchema.parse({ email: 'a@b.co', code: ' 482 913 ' }).code, '482913');
  for (const code of ['48291', '4829134', 'abcdef', '']) assert.equal(resetCodeSchema.safeParse({ email: 'a@b.co', code }).success, false);
});

test('route, live serverless path, and the forgot-password page', async () => {
  assert.match(fs.readFileSync(dist('routes/auth.routes.js'), 'utf8'), /router\.post\('\/password-reset\/verify-code', rateLimit_1\.authLimiter/);
  assert.match(fs.readFileSync(api('v1/auth.js'), 'utf8'), /'password-reset\/verify-code'/);
  const account = fs.readFileSync(api('_lib/auth-routes/account.js'), 'utf8');
  assert.match(account, /'password-reset\/verify-code': 'emailLink'/, 'tries are rate limited');
  assert.match(account, /action === 'password-reset\/verify-code'\) \{\s+const data = parseBody\(schemas\.resetCodeSchema/);
  const page = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/store/ForgotPassword.tsx'), 'utf8');
  assert.match(page, /autoComplete="one-time-code"/);
  assert.match(page, /navigate\('\/reset-password', \{ replace: true, state: \{ resetToken: token \} \}\)/);
  assert.match(fs.readFileSync(path.join(ROOT, 'frontend/src/pages/store/ResetPassword.tsx'), 'utf8'), /resetToken/);
});
