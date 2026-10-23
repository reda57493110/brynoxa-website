// The Express catch-all (/api?__path=...) must not serve routes that have their own function with
// shared rate limits (orders, coupons, sign-in, ...): calling it directly would skip those limits.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const handler = require(api('index.js'));
const { isBlockedPath } = handler;

test('routes with their own function are refused, in any spelling', () => {
  for (const p of ['orders', 'orders/track', 'Orders/Track', '//orders/', 'coupons/validate', 'auth/login', 'auth/mfa/login',
    'auth/register', 'admin/users', 'products', 'categories/x', 'wishlist', 'newsletter', 'push/subscribe', 'settings',
    'orders%2Ftrack', 'x/../orders', 'auth/me/addresses']) {
    assert.equal(isBlockedPath(p), true, p);
  }
});

test('routes that only Express serves still work', () => {
  for (const p of ['customers', 'customers/123', 'inventory/stock', 'profit', 'refunds', 'auth/sessions']) {
    assert.equal(isBlockedPath(p), false, p);
  }
});

test('a blocked path answers 404 without reaching Express', async () => {
  const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, on() {}, end(b) { this.body = b; this.done(); } };
  await new Promise((resolve) => { res.done = resolve; handler({ url: '/api?__path=coupons/validate', method: 'POST', headers: {} }, res); });
  assert.equal(res.statusCode, 404);
});
