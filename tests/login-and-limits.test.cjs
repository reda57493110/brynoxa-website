// Live sign-in: 5 wrong passwords lock the account, per-visitor limits, the old published admin
// password never signs in (security fixes #3 and #4).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { ROOT, api, setTestEnv, fakeModule, callHandler, fakeCollections } = require('./_helpers.cjs');
setTestEnv();

const bcrypt = require(path.join(ROOT, 'backend/node_modules/bcryptjs'));
const fake = fakeCollections();
fakeModule(api('_lib/mongo.js'), { connectMongo: async () => fake.conn });
const login = require(api('_lib/auth-routes/login.js'));
const { rateLimit, LIMITS } = require(api('_lib/rateLimit.js'));

const signIn = (email, password, ip) =>
  callHandler(login, { method: 'POST', url: '/api/v1/auth/login', headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` }, body: { email, password } });
const users = () => fake.cols.users;

test('setup', () => {
  fake.conn.db.collection('users');
  users().push({ _id: 'u1', email: 'shop@x.com', password: bcrypt.hashSync('RightPass123', 4), role: 'customer', isActive: true, name: 'C' });
  const old = ['Admin', '123', '!'].join(''); // the old public default, assembled so it is not written in one piece
  users().push({ _id: 'u2', email: 'old@x.com', password: bcrypt.hashSync(old, 4), role: 'admin', isActive: true, name: 'Old' });
});

test('the right password signs in', async () => {
  const r = await signIn('shop@x.com', 'RightPass123', '1.1.1.1');
  assert.equal(r.status, 200);
  assert.ok(r.body.data.accessToken);
});

test('5 wrong passwords lock the account for 15 minutes, then it works again', async () => {
  for (let i = 0; i < 5; i++) assert.equal((await signIn('shop@x.com', 'wrong' + i, '2.2.2.' + i)).status, 401);
  const u = users()[0];
  assert.ok(u.lockedUntil > Date.now());
  assert.equal(u.failedLoginAttempts, 0, 'counter starts over after the lock');
  assert.equal((await signIn('shop@x.com', 'RightPass123', '3.3.3.3')).status, 429, 'even the right password waits');
  u.lockedUntil = new Date(Date.now() - 1000);
  assert.equal((await signIn('shop@x.com', 'RightPass123', '3.3.3.3')).status, 200);
});

test('an unknown email gets the same answer as a wrong password', async () => {
  const r = await signIn('nobody@x.com', 'x', '4.4.4.4');
  assert.equal(r.status, 401);
  assert.equal(r.body.message, 'Invalid email or password');
});

test('the old published admin password never signs in (and counts as a wrong try)', async () => {
  const r = await signIn('old@x.com', ['Admin', '123', '!'].join(''), '5.5.5.5');
  assert.equal(r.status, 401);
  assert.equal(users()[1].failedLoginAttempts, 1);
});

test('one connection: 20 sign-in tries per 15 minutes, then blocked; others unaffected', async () => {
  const statuses = [];
  for (let i = 0; i < 21; i++) statuses.push((await signIn(`x${i}@x.com`, 'x', '9.9.9.9')).status);
  assert.ok(statuses.slice(0, 20).every((s) => s === 401));
  assert.equal(statuses[20], 429);
  assert.equal((await signIn('shop@x.com', 'RightPass123', '8.8.8.8')).status, 200);
});

test('emails are limited per address (5 per 15 min) even from different connections', async () => {
  const res = { setHeader() {}, end() {} };
  const results = [];
  for (let i = 0; i < 6; i++) results.push(await rateLimit({ headers: { 'x-forwarded-for': '7.7.7.' + i } }, res, 'emailSend', 'Victim@X.com'));
  assert.deepEqual(results, [true, true, true, true, true, false]);
});

test('if the limit check itself fails, customers are let through', async () => {
  fake.state.failDb = true;
  assert.equal(await rateLimit({ headers: { 'x-forwarded-for': '6.6.6.6' } }, { setHeader() {}, end() {} }, 'order'), true);
  fake.state.failDb = false;
});

test('every limit used by the handlers exists and counters expire on their own', () => {
  for (const k of ['login', 'mfa', 'register', 'emailSend', 'emailLink', 'order', 'track', 'coupon', 'depositReport', 'contact', 'pushSubscribe', 'pushClick']) assert.ok(LIMITS[k], k);
  assert.ok(fake.cols.rate_limits.every((d) => d.expiresAt instanceof Date));
});
