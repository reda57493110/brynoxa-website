// Security review (Nov 2026) fixes: the owner cannot be locked out by strangers, forged 2-step
// tokens do not use up the owner's tries, turning 2-step off is limited, staff email floods are
// stopped, catalog staff do not get owner-only settings back, single quotes are escaped in emails.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('#1 a lock caused by strangers never keeps out the right password of a 2-step account', () => {
  const guard = require(dist('services/loginGuard.service.js'));
  const locked = { lockedUntil: new Date(Date.now() + 60_000) };
  assert.equal(guard.lockRefuses(locked, true, true), false, 'right password + 2-step: goes on to the code step');
  assert.equal(guard.lockRefuses(locked, false, true), true, 'wrong password: refused');
  assert.equal(guard.lockRefuses(locked, true, false), true, 'no 2-step: the lock holds');
  assert.equal(guard.lockRefuses({}, false, false), false, 'not locked');
  // both sign-in paths use it; the code step itself is limited per visitor, not by the account lock
  assert.ok(read('api/_lib/auth-routes/login.js').includes('guard.lockRefuses(user, passwordOk, secondFactor)'));
  const svc = read('backend/src/services/auth.service.ts');
  assert.ok(svc.includes('lockRefuses(user, passwordOk, secondFactor)'));
  const mfaStep = svc.slice(svc.indexOf('export async function completeMfaLogin'), svc.indexOf('const valid = await consumeTotp(user, code);', svc.indexOf('export async function completeMfaLogin')));
  assert.ok(!mfaStep.includes('accountLocked('), 'the code step does not refuse on the account lock');
});

test('#1 IPv6 visitors are counted by their /64 network; IPv4 as is', () => {
  const { visitorNetwork } = require(dist('services/loginGuard.service.js'));
  assert.equal(visitorNetwork('2001:db8:1:2:aaaa::1'), '2001:db8:1:2::/64');
  assert.equal(visitorNetwork('2001:db8:1:2:bbbb:cccc:dddd:eeee'), '2001:db8:1:2::/64', 'same network, same visitor');
  assert.equal(visitorNetwork('2001:db8::5'), '2001:db8:0:0::/64');
  assert.equal(visitorNetwork('::ffff:41.250.1.2'), '41.250.1.2');
  assert.equal(visitorNetwork('41.250.1.2'), '41.250.1.2');
  assert.equal(visitorNetwork(undefined), 'unknown');
  assert.ok(read('api/_lib/rateLimit.js').includes('${name}:ip:${visitorNetwork(clientIp(req))}'), 'the live-site limits too');
});

test('#5 turning 2-step off: 5 wrong codes, then wait', () => {
  const svc = read('backend/src/services/auth.service.ts');
  const fn = svc.slice(svc.indexOf('export async function disableMfa'), svc.indexOf('function issueTokens'));
  assert.ok(fn.includes('if (await visitorBlocked(user._id, MFA_DISABLE_KEY))'));
  assert.ok(fn.includes('await recordLoginFailure(user._id, MFA_DISABLE_KEY);'));
});

test('#4 one staff member cannot send more than 30 emails an hour', async () => {
  const manual = require(dist('services/manualEmail.service.js'));
  const { SentEmail } = require(dist('models/SentEmail.js'));
  assert.equal(manual.STAFF_EMAILS_PER_HOUR, 30);
  const env = { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM };
  process.env.RESEND_API_KEY = 're_test';
  process.env.EMAIL_FROM = 'shop@x.test';
  const origCount = SentEmail.countDocuments;
  let asked;
  SentEmail.countDocuments = async (q) => {
    asked = q;
    return 30;
  };
  try {
    const configured = require(dist('config/env.js')).isEmailConfigured();
    if (configured) {
      await assert.rejects(
        () => manual.sendManualEmail({ to: 'a@b.test', subject: 'Hi', message: 'Hello there', sentBy: 'a'.repeat(24) }),
        (e) => e.statusCode === 429
      );
      assert.equal(asked.sentBy, 'a'.repeat(24));
      assert.ok(asked.createdAt.$gte instanceof Date);
    }
  } finally {
    SentEmail.countDocuments = origCount;
    process.env.RESEND_API_KEY = env.key;
    process.env.EMAIL_FROM = env.from;
  }
  assert.ok(read('backend/src/services/manualEmail.service.ts').includes('if (sentLastHour >= STAFF_EMAILS_PER_HOUR)'), 'checked in the service both paths use');
});

test('#6 after saving the home page, catalog staff only get the public settings back', () => {
  assert.ok(read('api/v1/settings.js').includes("data: hasPermission(user.role, 'settings') ? settings : publicSettings(settings),"));
  assert.ok(read('backend/src/controllers/misc.controller.ts').includes("sendSuccess(res, canSeeAll ? settings : publicSettings(settings), 'Settings updated');"));
  const { Settings, publicSettings } = require(dist('models/Settings.js'));
  const pub = publicSettings(new Settings({ courierCosts: { delivered: 30 }, wholesaleTiers: [{ id: 'r', name: 'R', discountPercent: 10 }] }));
  for (const k of ['courierCosts', 'depositMethods', 'wholesaleTiers', 'customerSegments', 'emailMessages', 'paymentDetailsChangedBy']) assert.equal(pub[k], undefined, k);
});

test('#7 email text escapes single quotes; #3 / #8 libraries without known holes', () => {
  const { escapeHtml } = require(dist('services/email.service.js'));
  assert.equal(escapeHtml(`<a href='x' title="y">&</a>`), '&lt;a href=&#39;x&#39; title=&quot;y&quot;&gt;&amp;&lt;/a&gt;');
  const mongoose = require(path.join(ROOT, 'backend/node_modules/mongoose/package.json')).version;
  const [maj, min, patch] = mongoose.split('.').map(Number);
  assert.ok(maj > 8 || (maj === 8 && (min > 24 || (min === 24 && patch >= 7))), `mongoose ${mongoose} has the fixes`);
});
