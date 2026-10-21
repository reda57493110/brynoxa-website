// The shop pages (frontend/src/lib) and the server (backend/src/utils) keep hand-written copies of
// the money rules. These tests make sure both copies give the same answer, so a customer never
// sees one price and pays another. Run with tsx (see `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const load = (p: string) => import(pathToFileURL(path.join(root, p)).href);

const serverShipping = await load('backend/src/utils/shipping.ts');
const shopShipping = await load('frontend/src/lib/shipping.ts');
const serverDeposit = await load('backend/src/utils/deposit.ts');
const shopDeposit = await load('frontend/src/lib/deposit.ts');

const settings = { shippingFlatRate: 40, freeShippingMin: 1000, shippingByCity: [{ city: 'Dakhla', rate: 90 }] };

test('shipping: same result in the shop and on the server; free shipping is checked after the coupon', () => {
  const cases: [string | undefined, number, number, number][] = [
    // city, cart, coupon, expected shipping
    ['Casablanca', 1050, 100, 40], // 950 DH after the coupon: not free
    ['Casablanca', 1200, 100, 0], // 1,100 DH: free
    ['Casablanca', 1000, 0, 0], // exactly the minimum: free
    ['dakhla', 500, 0, 90], // per-city price, any capitals
    [undefined, 300, 0, 40],
  ];
  for (const [city, cart, coupon, expected] of cases) {
    const items = Math.max(0, cart - coupon);
    assert.equal(serverShipping.resolveShippingFee(settings, city, items), expected, `server ${city} ${cart}-${coupon}`);
    assert.equal(shopShipping.resolveShippingFee(settings, city, items), expected, `shop ${city} ${cart}-${coupon}`);
  }
});

test('deposit per product line: same result in the shop and on the server', () => {
  const rules = [null, { type: 'fixed', value: 200 }, { type: 'percent', value: 10 }, { type: 'percent', value: 150 }, { type: 'fixed', value: 5000 }];
  for (const rule of rules) {
    for (const [price, qty] of [[3600, 1], [450, 3], [99.99, 2]]) {
      assert.equal(shopDeposit.lineDeposit(rule, price, qty), serverDeposit.lineDeposit(rule, price, qty), `${JSON.stringify(rule)} ${price}×${qty}`);
    }
  }
});

test('amount collected on delivery: deposit and covered transfer fees taken off, never below 0', () => {
  const orders = [
    { pricing: { total: 2000 }, deposit: { amount: 200, status: 'received', payment: { fee: 35 } } }, // fees reported by the customer
    { pricing: { total: 2000 }, deposit: { amount: 200, status: 'received', feeCredit: 0, payment: { fee: 35 } } }, // staff: no fees covered
    { pricing: { total: 2000 }, deposit: { amount: 200, status: 'received', feeCredit: 20 } },
    { pricing: { total: 2000 }, deposit: { amount: 2000, status: 'received' } },
    { pricing: { total: 2000 }, deposit: null },
  ];
  const expected = [1765, 1800, 1780, 0, 2000];
  orders.forEach((o, i) => {
    assert.equal(serverDeposit.dueOnDelivery(o), expected[i], `server case ${i}`);
    assert.equal(shopDeposit.dueOnDelivery(o), expected[i], `shop case ${i}`);
  });
});
