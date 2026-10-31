// Track order with the phone only: a guest who lost the order number sees the orders delivered to
// that phone — in a short form, because anyone can type someone's phone: no name, street address,
// notes, payment details or full order number (the order number still opens the full view).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, dist, ROOT, setTestEnv, fakeModule, callHandler } = require('./_helpers.cjs');
setTestEnv();

fakeModule(api('_lib/mongo.js'), { connectMongo: async () => ({}) });
fakeModule(api('_lib/rateLimit.js'), { rateLimit: async () => true });
fakeModule(api('_lib/auth.js'), { optionalUser: async () => null, requireUser: async () => null });

const { Order } = require(dist('models/Order.js'));
const orders = require(dist('services/order.service.js'));

const ahmed = (n, phone, status = 'shipped') =>
  new Order({
    orderNumber: `BRX-2026102${n}-K7M2Q${n}`,
    orderStatus: status,
    shippingAddress: { fullName: 'Ahmed Benali', line1: '12 Rue Atlas, Maarif', city: 'Casablanca', postalCode: '00000', country: 'MA', phone },
    items: [{ product: 'a'.repeat(24), name: 'HP EliteBook 840', sku: 'HP-840', qty: 1, price: 5000, unitCost: 4000, image: 'https://res.cloudinary.com/x/image/upload/hp.jpg' }],
    pricing: { subtotal: 5000, discount: 0, shipping: 0, tax: 0, total: 5000 },
    adminNote: 'Calls after 18:00',
    timeline: [
      { status: 'pending', at: new Date('2026-10-20'), note: 'Order placed' },
      { status: 'shipped', at: new Date('2026-10-21'), staffNote: 'Gave to Amana', internal: false, note: 'Leave at the door, code 1234' },
      { status: 'confirmed', at: new Date('2026-10-20'), internal: true },
    ],
  });
let stored = [];
Order.find = (q) => {
  const rx = q['shippingAddress.phone'];
  const list = stored.filter((o) => rx.test(o.shippingAddress.phone));
  return { sort: () => ({ limit: async () => list }) };
};

test('the order number is masked: enough to tell orders apart, not to open them', () => {
  assert.equal(orders.maskOrderNumber('BRX-20261020-K7M2QX'), 'BRX-20261020-••••QX');
});

test('phone only: the orders delivered to this phone (written any way), short form', async () => {
  stored = [ahmed(1, '06 12 34 56 78'), ahmed(2, '+212612345678', 'delivered'), ahmed(3, '0699999999')];
  const found = await orders.trackOrdersByPhone('0612345678');
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((o) => o.orderStatus), ['shipped', 'delivered']);
  const json = JSON.stringify(found);
  for (const secret of ['Ahmed', 'Rue Atlas', 'Maarif', 'K7M2Q1', 'Calls after', 'Amana', 'code 1234', 'unitCost', '4000']) {
    assert.ok(!json.includes(secret), `must not show: ${secret}`);
  }
  assert.equal(found[0].city, 'Casablanca');
  assert.equal(found[0].total, 5000);
  assert.deepEqual(found[0].items, [{ name: 'HP EliteBook 840', qty: 1, price: 5000, image: 'https://res.cloudinary.com/x/image/upload/hp.jpg' }], 'with the product photo');
  assert.deepEqual(found[0].timeline.map((s) => s.status), ['pending', 'shipped'], 'internal steps hidden');
});

test('nothing for an unknown or too short phone', async () => {
  stored = [ahmed(1, '0612345678')];
  await assert.rejects(orders.trackOrdersByPhone('0677777777'), (e) => e.statusCode === 404);
  await assert.rejects(orders.trackOrdersByPhone('0612'), (e) => e.statusCode === 400);
});

test('live site: an empty order number gives the short list; with the number, the full order as before', async () => {
  const { trackOrderSchema } = require(dist('validators/schemas'));
  assert.ok(trackOrderSchema.safeParse({ orderNumber: '', phone: '0612345678' }).success);
  assert.ok(trackOrderSchema.safeParse({ phone: '0612345678' }).success);
  stored = [ahmed(1, '0612345678')];
  const handler = require(api('v1/orders.js'));
  const res = await callHandler(handler, { method: 'POST', url: '/api/v1/orders?__route=track', body: { orderNumber: '', phone: '0612345678' } });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.phoneMatches.length, 1);
  assert.equal(res.body.data.phoneMatches[0].orderRef, 'BRX-20261021-••••Q1');
  assert.match(fs.readFileSync(path.join(ROOT, 'backend/src/controllers/order.controller.ts'), 'utf8'), /if \(!req\.body\.orderNumber\) \{\s+sendSuccess\(res, \{ phoneMatches/);
});

test('the page: order number optional, explains the lost-number option and what stays private', () => {
  const page = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/store/TrackOrder.tsx'), 'utf8');
  assert.match(page, /trackOptional/);
  assert.match(page, /t\('orders\.trackLostNumber'\)/);
  assert.match(page, /t\('orders\.trackPhonePrivacy'\)/);
  const short = page.slice(page.indexOf('function PhoneMatches'), page.indexOf('export function TrackOrder'));
  assert.ok(short.length > 200);
  assert.doesNotMatch(short, /fullName|line1|DepositNotice/, 'no name, address or payment details');
  assert.match(short, /<OrderProgress status=\{m\.orderStatus\} timeline=\{m\.timeline\} notes=\{false\} \/>/, 'no step notes');
  // Phone first (required), order number second (optional)
  assert.ok(page.indexOf("label={t('orders.trackPhone')}") < page.indexOf("t('orders.trackOrderNumber')"));
});

test('progress: detailed statuses sit on the 4 customer steps', async () => {
  const { orderStepIndex } = await import('../frontend/src/lib/orderProgress.ts').catch(() => ({}));
  const src = fs.readFileSync(path.join(ROOT, 'frontend/src/lib/orderProgress.ts'), 'utf8');
  if (!orderStepIndex) {
    // Plain Node cannot load the .ts file: check the rules in the source
    assert.match(src, /status === 'shipped' \|\| status === 'rescheduled' \|\| status === 'delivery_failed'\) return 2/);
    assert.match(src, /status === 'delivered' \|\| \/return\/\.test\(status\)\) return 3/);
    return;
  }
  assert.equal(orderStepIndex('no_answer'), 0);
  assert.equal(orderStepIndex('rescheduled'), 2);
  assert.equal(orderStepIndex('returned'), 3);
});

test('each product shows its photo (full and phone-only views)', () => {
  const page = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/store/TrackOrder.tsx'), 'utf8');
  assert.match(page, /src=\{item\.image \? sizedImageUrl\(item\.image, 160\) : undefined\}/);
  assert.equal((page.match(/<ItemsList items=/g) || []).length, 2);
});
