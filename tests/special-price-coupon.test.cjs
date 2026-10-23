// "Special price on products" coupons (e.g. for a friend): only the chosen products get their
// special price; the discount is worked out on the server from its own prices.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { api, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Coupon } = require(dist('models/Coupon'));
const orders = require(dist('services/order.service'));
const coupons = require(dist('services/coupon.service'));
const { couponSchema, validateCouponSchema } = require(dist('validators/schemas'));

const LAPTOP = '64d000000000000000000001';
const MOUSE = '64d000000000000000000002';
const friend = {
  code: 'FRIEND',
  type: 'price',
  value: 0,
  isActive: true,
  minOrder: 0,
  maxUses: 0,
  usedCount: 0,
  productPrices: [{ product: LAPTOP, price: 4500 }],
};
Coupon.findOne = async () => friend;

test('only the chosen products get the special price, per unit', () => {
  const lines = [
    { product: LAPTOP, price: 5000, qty: 2 },
    { product: MOUSE, price: 200, qty: 1 },
  ];
  assert.equal(orders.specialPriceDiscount(friend.productPrices, lines), 1000);
  // A line already cheaper than the special price gets nothing (never a price increase)
  assert.equal(orders.specialPriceDiscount(friend.productPrices, [{ product: LAPTOP, price: 4000, qty: 1 }]), 0);
});

test('checking the code: the discount needs the product in the cart', async () => {
  const { discount } = await orders.validateCoupon('friend', 5200, [{ product: LAPTOP, price: 5000, qty: 1 }, { product: MOUSE, price: 200, qty: 1 }]);
  assert.equal(discount, 500);
  await assert.rejects(orders.validateCoupon('friend', 200, [{ product: MOUSE, price: 200, qty: 1 }]), /for other products/);
  await assert.rejects(orders.validateCoupon('friend', 5000), /for other products/);
});

test('the form: products and prices are checked; a special-price coupon needs a product', async () => {
  assert.ok(couponSchema.safeParse({ code: 'FRIEND', type: 'price', value: 0, productPrices: [{ product: LAPTOP, price: 4500 }] }).success);
  assert.ok(!couponSchema.safeParse({ code: 'FRIEND', type: 'price', value: 0, productPrices: [{ product: 'x', price: 4500 }] }).success);
  assert.ok(!couponSchema.safeParse({ code: 'FRIEND', type: 'price', value: 0, productPrices: [{ product: LAPTOP, price: -1 }] }).success);
  assert.ok(validateCouponSchema.safeParse({ code: 'FRIEND', subtotal: 1, items: [{ productId: LAPTOP, qty: 1 }] }).success);
  Coupon.findOne = async () => null;
  await assert.rejects(coupons.createCoupon({ code: 'FRIEND2', type: 'price', value: 0, productPrices: [] }), /at least one product/);
  Coupon.findOne = async () => friend;
});

test('orders and the checkout check use the cart lines', () => {
  const src = fs.readFileSync(dist('services/order.service.js'), 'utf8');
  assert.equal((src.match(/priceOrder\(subtotal, (input\.couponCode|previousCouponCode), (input|order)\.shippingAddress\?\.city, orderItems\)/g) || []).length, 2);
  assert.match(fs.readFileSync(api('v1/orders.js'), 'utf8'), /validateCoupon\(body\.code, body\.subtotal, await orderService\.couponLinesFor\(body\.items\)\)/);
});
