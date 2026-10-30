// Checkout fixes (scan, group 1):
// - a signed-in customer whose sign-in expired gets 401 (the shop renews it and resends the order)
//   instead of a guest order failing with "Email is required";
// - the shop knows when emails are off (password reset offers WhatsApp instead);
// - checkout totals use today's prices and send the coupon that was applied;
// - a product page starts fresh for each product (quantity does not carry over);
// - a session refresh does not replace the address typed at checkout.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, dist, ROOT, setTestEnv, fakeModule, callHandler } = require('./_helpers.cjs');
setTestEnv();

fakeModule(api('_lib/mongo.js'), { connectMongo: async () => ({}) });
fakeModule(api('_lib/rateLimit.js'), { rateLimit: async () => true });
fakeModule(api('_lib/auth.js'), { optionalUser: async () => null, requireUser: async () => null });
const authService = require(dist('services/auth.service.js'));
const reached = [];
authService.resolveCheckoutCustomer = async (input) => {
  reached.push(input);
  const { ApiError } = require(dist('utils/ApiError.js'));
  throw new ApiError(418, 'stop here');
};
const handler = require(api('v1/orders.js'));

const order = (extra = {}) => ({
  items: [{ productId: 'a'.repeat(24), qty: 1 }],
  shippingAddress: { fullName: 'Youssef Amrani', phone: '0612345678', line1: '12 Rue Ibn Sina', city: 'Rabat' },
  ...extra,
});
const post = (body, headers = {}) => callHandler(handler, { method: 'POST', url: '/api/v1/orders', headers, body });

test('expired sign-in without an email: 401 so the shop renews the session and resends', async () => {
  const r = await post(order(), { authorization: 'Bearer expired.or.invalid' });
  assert.equal(r.status, 401);
  assert.equal(reached.length, 0, 'never treated as a guest order');
});

test('guests and customers who typed an email still go through', async () => {
  reached.length = 0;
  assert.equal((await post(order({ email: 'guest@example.com' }))).status, 418);
  assert.equal((await post(order({ email: 'old@example.com' }), { authorization: 'Bearer expired' })).status, 418);
  assert.equal(reached.length, 2);
});

test('the local server does the same (refuseExpiredSession on POST /orders)', () => {
  const { refuseExpiredSession } = require(dist('middleware/auth.js'));
  const run = (req) => {
    let out;
    refuseExpiredSession(req, {}, (err) => (out = err));
    return out;
  };
  assert.equal(run({ headers: { authorization: 'Bearer x' }, body: {} })?.statusCode, 401);
  assert.equal(run({ headers: { authorization: 'Bearer x' }, body: {}, user: { userId: 'u' } }), undefined);
  assert.equal(run({ headers: { authorization: 'Bearer x' }, body: { email: 'a@b.c' } }), undefined);
  assert.equal(run({ headers: {}, body: {} }), undefined);
  const routes = fs.readFileSync(dist('routes/commerce.routes.js'), 'utf8');
  assert.match(routes, /router\.post\('\/orders', auth_1\.optionalAuth, [^\n]*auth_1\.refuseExpiredSession, order\.createOrder\)/);
});

test('public settings tell the shop whether emails can be sent (no Resend key: off)', () => {
  const { publicSettings } = require(dist('models/Settings.js'));
  const out = publicSettings({ storeName: 'Brynoxa', courierCosts: { delivered: 30 }, storageLimitMb: 1024 });
  assert.equal(out.emailEnabled, false);
  assert.equal('courierCosts' in out, false, 'private fields still removed');
  assert.equal('storageLimitMb' in out, false);
});

const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');

test('checkout: today’s prices, the applied coupon, a last price check, no address reset', () => {
  const checkout = src('pages/store/Checkout.tsx');
  assert.match(checkout, /couponCode: appliedCoupon \|\| undefined/);
  assert.match(checkout, /const subtotal = sumOf\(lines, \(l\) => l\.charged\)/);
  assert.match(checkout, /setFormError\(t\('checkout\.pricesChanged'\)\)/);
  assert.match(checkout, /\}, \[user\?\._id\]\)/);
  assert.match(src('pages/store/Cart.tsx'), /useCartLiveProducts\(\)/);
  assert.match(src('store/cartStore.ts'), /syncLive: \(live\) =>/);
});

test('product page: fresh for each product; forgot password offers WhatsApp when emails are off', () => {
  assert.match(src('pages/store/ProductDetail.tsx'), /return <ProductDetailPage key=\{slug\} \/>/);
  assert.match(src('pages/store/ForgotPassword.tsx'), /settings\.data\?\.emailEnabled === false/);
  for (const lang of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${lang}.ts`);
    for (const key of ['resetByWhatsApp', 'resetWhatsAppButton', 'resetWhatsAppMessage', 'pricesUpdated', 'pricesChanged']) {
      assert.match(t, new RegExp(`\\b${key}:`), `${lang}: ${key}`);
    }
  }
});
