// Coupons can be limited per customer (by account or phone); order floods limited per email / phone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { dist, api, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const orders = require(dist('services/order.service'));

test('the same phone written differently is the same customer', () => {
  assert.equal(orders.phoneKey('06 12 34 56 78'), orders.phoneKey('+212 612-345678'));
  assert.equal(orders.phoneKey('0612345678'), '612345678');
});

test('order creation checks the per-customer coupon limit before using the coupon', () => {
  const src = fs.readFileSync(dist('services/order.service.js'), 'utf8');
  const check = src.indexOf('await assertCouponPerCustomer(couponMeta.couponId');
  const claim = src.indexOf('await claimCoupon(couponMeta.couponId)');
  assert.ok(check > 0 && check < claim, 'checked first');
  assert.match(src, /orderStatus: \{ \$ne: 'cancelled' \}/);
  const { Coupon } = require(dist('models/Coupon'));
  assert.equal(new Coupon({ code: 'WELCOME', type: 'percent', value: 10 }).perCustomerLimit, 0, 'no limit unless set');
});

test('orders are also limited per email and per phone (any connection)', () => {
  const src = fs.readFileSync(api('v1/orders.js'), 'utf8');
  assert.match(src, /rateLimit\(req, res, 'orderPerCustomer', emailKey, \{ perIp: false \}\)/);
  assert.match(src, /rateLimit\(req, res, 'orderPerCustomer', `phone:\$\{phoneKey\}`, \{ perIp: false \}\)/);
  const { createOrderSchema } = require(dist('validators/schemas'));
  const item = { productId: 'a'.repeat(24), qty: 1 };
  const addr = { fullName: 'A B', phone: '0612345678', line1: 'x', city: 'Rabat' };
  assert.equal(createOrderSchema.safeParse({ items: Array(51).fill(item), shippingAddress: addr, email: 'a@x.com' }).success, false, 'max 50 lines');
});
