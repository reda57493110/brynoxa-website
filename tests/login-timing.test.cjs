// Sign-in takes the same time whether or not an email has an account (security fix #9): one
// password check with the same cost every time — unknown email, wrong password or locked account.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, api, dist, setTestEnv, fakeModule, callHandler, fakeCollections } = require('./_helpers.cjs');
setTestEnv();

const bcrypt = require(path.join(ROOT, 'backend/node_modules/bcryptjs'));
// Record the cost of every hash a password is compared with
const costs = [];
const realCompare = bcrypt.compare;
bcrypt.compare = (pw, hash, ...rest) => {
  costs.push(Number(String(hash).split('$')[2]));
  return realCompare(pw, hash, ...rest);
};

const fake = fakeCollections();
fakeModule(api('_lib/mongo.js'), { connectMongo: async () => fake.conn });
const login = require(api('_lib/auth-routes/login.js'));
const timing = require(dist('utils/passwordTiming'));

const signIn = (email, password, ip) =>
  callHandler(login, { method: 'POST', url: '/api/v1/auth/login', headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` }, body: { email, password } });

test('the dummy hash has the same cost as real passwords and never matches', async () => {
  assert.equal(timing.PASSWORD_HASH_ROUNDS, 12);
  assert.equal(bcrypt.getRounds(timing.DUMMY_PASSWORD_HASH), 12);
  assert.equal(await timing.checkPasswordEvenTime('anything', undefined), false);
  assert.equal(await timing.checkPasswordEvenTime('', null), false);
});

test('unknown email, wrong password and locked account: each one check at cost 12', async () => {
  fake.conn.db.collection('users');
  const hash = bcrypt.hashSync('RightPass123', 12);
  fake.cols.users.push({ _id: 'u1', email: 'real@x.com', password: hash, role: 'customer', isActive: true, name: 'R' });
  fake.cols.users.push({ _id: 'u2', email: 'locked@x.com', password: hash, role: 'customer', isActive: true, name: 'L', lockedUntil: new Date(Date.now() + 60_000) });

  costs.length = 0;
  assert.equal((await signIn('nobody@x.com', 'x', '1.1.1.1')).status, 401);
  assert.equal((await signIn('real@x.com', 'wrong', '1.1.1.2')).status, 401);
  assert.equal((await signIn('locked@x.com', 'wrong', '1.1.1.3')).status, 429);
  assert.deepEqual(costs, [12, 12, 12]);
});

test('Express sign-in also checks the password before anything else', () => {
  const svc = fs.readFileSync(dist('services/auth.service.js'), 'utf8');
  const fn = svc.slice(svc.indexOf('async function loginUser'), svc.indexOf('async function completeMfaLogin'));
  const check = fn.indexOf('checkPasswordEvenTime)(password, user?.password)');
  assert.ok(check > 0, 'uses the even-time check');
  assert.ok(check < fn.indexOf('temporarily locked'), 'before the lock answer');
  assert.ok(!/comparePassword/.test(fn));
});
