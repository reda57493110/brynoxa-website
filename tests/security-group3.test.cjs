// Scan fixes, group 3 (security):
// 15 wrong passwords block the visitor who typed them, not the owner signing in elsewhere
//    (sign-in tests in login-and-limits.test.cjs); wrong current passwords count too;
// 16 an order entered by order staff comes back without purchase costs;
// 18 customers never see which staff member entered their order;
// 19 sign-out ends the session even after the access token expired; session tokens are never
//    accepted as sign-in tokens.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { api, dist, setTestEnv, fakeModule, callHandler, fakeCollections } = require('./_helpers.cjs');
setTestEnv();

test('15: changing the password counts wrong current passwords like sign-in', async () => {
  const svc = fs.readFileSync(dist('services/auth.service.js'), 'utf8');
  const fn = svc.slice(svc.indexOf('async function changePassword'), svc.indexOf('async function getMe'));
  assert.match(fn, /visitorBlocked\)\(userId, meta\.ip\)/);
  assert.match(fn, /recordLoginFailure\)\(user\._id, meta\.ip\)/);
  assert.match(fs.readFileSync(api('_lib/auth-routes/change-password.js'), 'utf8'), /changePassword\(user\._id\.toString\(\), currentPassword, newPassword, getRequestMeta\(req\)\)/);
  const guard = require(dist('services/loginGuard.service.js'));
  assert.equal(guard.VISITOR_MAX_FAILURES, 5);
  assert.ok(guard.ACCOUNT_MAX_FAILURES >= 50, 'one person cannot lock the whole account');
});

test('16: a new order entered by order staff comes back without purchase costs', () => {
  const { hideCostsFor } = require(dist('utils/hideCosts.js'));
  const order = { orderNumber: 'BRX-1', items: [{ name: 'HP', price: 3600, qty: 1, unitCost: 2800 }] };
  assert.equal('unitCost' in hideCostsFor('orders', order).items[0], false);
  assert.equal(hideCostsFor('admin', order).items[0].unitCost, 2800);
  assert.match(fs.readFileSync(api('v1/admin.js'), 'utf8'), /data: hideCostsFor\(user\.role, order\)/);
  assert.match(fs.readFileSync(dist('controllers/order.controller.js'), 'utf8'), /hideCostsFor\)\(req\.user\?\.role, order\), 'Order added', 201/);
});

test('18: the customer view of an order hides who on the staff entered it', () => {
  const { customerOrderView } = require(dist('services/order.service.js'));
  const view = customerOrderView({ orderNumber: 'BRX-1', origin: 'instagram', createdBy: 'staff1', items: [], timeline: [] });
  assert.equal('createdBy' in view, false);
  assert.equal(view.origin, 'instagram');
});

test('19: sign-out with an expired access token still ends the session on the server', async () => {
  const jwt = require(require.resolve('jsonwebtoken', { paths: [dist('')] }));
  const ended = [];
  fakeModule(api('_lib/mongo.js'), { connectMongo: async () => fakeCollections().conn });
  const auth = require(dist('services/auth.service.js'));
  auth.logoutByRefreshToken = async (token) => ended.push(token);
  const logout = require(api('_lib/auth-routes/logout.js'));
  const refresh = jwt.sign({ userId: 'u1', role: 'customer', purpose: 'refresh' }, process.env.JWT_REFRESH_SECRET);
  const expired = jwt.sign({ userId: 'u1', role: 'customer' }, process.env.JWT_ACCESS_SECRET, { expiresIn: -10 });
  const r = await callHandler(logout, {
    method: 'POST',
    headers: { authorization: `Bearer ${expired}`, cookie: `brynoxa_csrf=x; brynoxa_refresh=${refresh}` },
  });
  assert.equal(r.status, 200);
  assert.deepEqual(ended, [refresh]);
  assert.match(fs.readFileSync(dist('routes/auth.routes.js'), 'utf8'), /router\.post\('\/logout', auth_1\.optionalAuth, /);
});

test('19: session tokens are marked and refused as sign-in tokens', () => {
  const tokens = require(dist('utils/tokens.js'));
  const session = tokens.signRefreshToken({ userId: 'u1', role: 'admin' });
  assert.equal(tokens.verifyRefreshToken(session).purpose, 'refresh');
  // Even signed with the access key (both secrets the same), it is not a sign-in token
  const jwt = require(require.resolve('jsonwebtoken', { paths: [dist('')] }));
  const sameKey = jwt.sign({ userId: 'u1', role: 'admin', purpose: 'refresh' }, process.env.JWT_ACCESS_SECRET);
  assert.throws(() => tokens.verifyAccessToken(sameKey), /Not an access token/);
  for (const f of ['_lib/auth-routes/login.js', '_lib/auth-routes/refresh.js']) {
    assert.match(fs.readFileSync(api(f), 'utf8'), /purpose: 'refresh' \}, process\.env\.JWT_REFRESH_SECRET/, f);
  }
});
