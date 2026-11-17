// Second security audit (Nov 2026): money, private data, abuse and configuration fixes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('#1 order tracking never shows cash withdrawal codes, the sender phone or the reference', () => {
  const { Order } = require(dist('models/Order.js'));
  const svc = require(dist('services/order.service.js'));
  const order = new Order({
    orderNumber: 'BRX-20261117-ABCDEF',
    orderStatus: 'pending',
    shippingAddress: { fullName: 'A', line1: 'x', city: 'Rabat', phone: '0612345678' },
    items: [],
    pricing: { subtotal: 100, discount: 0, shipping: 0, tax: 0, total: 100 },
    deposit: { amount: 50, status: 'pending', payment: { methodId: 'atm', methodName: 'ATM', codes: [{ label: 'Code', value: '839201' }, { label: 'PIN', value: '4417' }], senderPhone: '0698765432', reference: 'TRX-55667788' } },
  });
  const view = svc.customerOrderView(order);
  const json = JSON.stringify(view);
  for (const secret of ['839201', '4417', '0698765432', 'TRX-55667788']) assert.ok(!json.includes(secret), secret);
  assert.deepEqual(view.deposit.payment.codes.map((c) => c.label), ['Code', 'PIN'], 'the customer still sees which codes were sent');
  assert.equal(view.deposit.payment.senderPhone, '••••432');
});

test('#3 wholesale prices never go to a guest (found by phone or email alone)', async () => {
  const { User } = require(dist('models/User.js'));
  const wholesale = require(dist('services/wholesale.service.js'));
  const orig = User.findById;
  User.findById = () => ({ select: async () => ({ role: 'customer', isActive: true, isGuest: true, customerType: 'wholesale', wholesale: { status: 'approved', tierId: 'r' } }) });
  try {
    assert.equal(await wholesale.getWholesaleTerms('a'.repeat(24)), null);
  } finally {
    User.findById = orig;
  }
});

test('#4 a real phone number only: one extra digit is refused (no way around a blocked number)', () => {
  const { createOrderSchema } = require(dist('validators/schemas.js'));
  const { validCustomerPhone } = require(dist('utils/siteContact.js'));
  for (const ok of ['0612345678', '06 12 34 56 78', '+212 6 12 34 56 78', '00212612345678', '+33 6 12 34 56 78']) assert.ok(validCustomerPhone(ok), ok);
  for (const bad of ['0612345678 0', '06 12 34 56 78-1', '+2126123456780', '0612', 'abc', '']) assert.ok(!validCustomerPhone(bad), bad);
  const base = { items: [{ productId: 'p1', qty: 1 }], shippingAddress: { fullName: 'A B', line1: 'Rue 1', city: 'Rabat', phone: '0612345678 0' } };
  assert.ok(!createOrderSchema.safeParse(base).success, 'the order form refuses it on both paths');
  assert.ok(read('frontend/src/pages/store/Checkout.tsx').includes('if (!validCustomerPhone(address.phone)) {'), 'checked in the shop too');
  const back = read('backend/src/utils/siteContact.ts');
  const front = read('frontend/src/lib/siteContact.ts');
  assert.ok(back.includes("return n.startsWith('212') ? n.length === 12 : true;") && front.includes("return n.startsWith('212') ? n.length === 12 : true"));
});

test('#5 order emails: a daily budget per address and for the shop; past it, the order is still placed', async () => {
  const budget = require(dist('utils/emailBudget.js'));
  assert.equal(budget.ORDER_EMAILS_PER_ADDRESS_PER_DAY, 3);
  assert.equal(budget.ORDER_EMAILS_PER_DAY, 60);
  assert.equal(await budget.orderEmailAllowed('a@b.test'), true, 'no database (tests): allowed');
  assert.ok(read('backend/src/services/orderNotify.service.ts').includes('  if (!(await orderEmailAllowed(customer.email))) return false;'));
});

test('#6 deposit receipts: 5 photos a day per customer', () => {
  const dep = require(dist('services/depositPayment.service.js'));
  assert.equal(dep.MAX_RECEIPTS_PER_DAY, 5);
  assert.ok(read('backend/src/services/depositPayment.service.ts').includes("if (recent >= MAX_RECEIPTS_PER_DAY) throw new ApiError(429"));
});

test('#7 refunds and coupon give-backs are saved atomically (two clicks cannot double them)', async () => {
  const svc = read('backend/src/services/order.service.ts');
  assert.ok(svc.includes('{ _id: order._id, refunds: { $size: (order.refunds || []).length } },'), 'refund saved only if no refund was added meanwhile');
  assert.ok(svc.includes("{ _id: order._id, 'coupon.released': { $ne: true } }"));
  const { Order } = require(dist('models/Order.js'));
  const { Coupon } = require(dist('models/Coupon.js'));
  const orders = require(dist('services/order.service.js'));
  const orig = { o: Order.updateOne, c: Coupon.updateOne };
  let couponCalls = 0;
  let marked = 0;
  Order.updateOne = async () => ({ modifiedCount: marked++ === 0 ? 1 : 0 });
  Coupon.updateOne = async () => {
    couponCalls++;
    return {};
  };
  try {
    const order = { _id: 'o1', coupon: { couponId: 'c1' } };
    await Promise.all([orders.giveCouponBack({ ...order, coupon: { ...order.coupon } }), orders.giveCouponBack({ ...order, coupon: { ...order.coupon } })]);
    assert.equal(couponCalls, 1, 'given back once');
  } finally {
    Order.updateOne = orig.o;
    Coupon.updateOne = orig.c;
  }
});

test('#8 shop search: 90 a minute per connection on both paths', () => {
  const { LIMITS } = require(api('_lib/rateLimit.js'));
  assert.deepEqual([LIMITS.search.max, LIMITS.search.windowMs], [90, 60_000]);
  assert.ok(read('api/v1/products.js').includes("if (!isAdmin && String(raw.q || '').trim() && !(await rateLimit(req, res, 'search'))) return;"));
  assert.ok(read('backend/src/routes/catalog.routes.ts').includes("router.get('/products', optionalAuth, searchLimiter, catalog.getProducts);"));
});

test('#9 #10 staff sign-out stops order alerts on that device; the customer export is owner-only', () => {
  assert.ok(read('frontend/src/store/authStore.ts').includes("void import('@/lib/push').then((m) => m.unsubscribeFromPush())"));
  assert.ok(read('backend/src/routes/customer.routes.ts').includes("router.get('/admin/customers/export', requireAuth, requirePermission('users:manage'), customer.exportCsv);"));
  assert.ok(read('frontend/src/pages/admin/Customers.tsx').includes("const canExport = hasPermission(role, 'users:manage')"));
});

test('#11 units sent back before delivery are not counted as collected (refunds, profit)', () => {
  const { amountPaidOnOrder } = require(dist('services/order.service.js'));
  const base = { orderStatus: 'delivered', deliveredAt: new Date(), pricing: { total: 10_000 }, deposit: null };
  assert.equal(amountPaidOnOrder(base), 10_000);
  assert.equal(amountPaidOnOrder({ ...base, uncollected: 4_000 }), 6_000);
  const svc = read('backend/src/services/order.service.ts');
  assert.ok(svc.includes('const back = order.items.reduce((a, i) => a + i.price * (i.returnedQty || 0), 0);'));
  assert.ok(read('backend/src/services/profit.service.ts').includes('o.pricing.total - fees - (o.uncollected ?? 0)'));
});

test('#12 a failed start is tried again on the next request', () => {
  assert.match(read('backend/src/app.ts'), /initPromise = null;\r?\n\s+throw err;/);
});

test('#13 size limits: wishlist, brand form, push keys', () => {
  const { wishlistSyncSchema, brandSchema, pushSubscribeSchema } = require(dist('validators/schemas.js'));
  assert.ok(!wishlistSyncSchema.safeParse({ productIds: Array(101).fill('a') }).success);
  assert.ok(wishlistSyncSchema.safeParse({ productIds: ['a'.repeat(24)] }).success);
  assert.ok(read('api/v1/wishlist.js').includes('wishlistSyncSchema.safeParse(body)'), 'checked on the live site too');
  assert.ok(!brandSchema.safeParse({ name: 'x'.repeat(61) }).success);
  assert.ok(!brandSchema.safeParse({ name: 'HP', logo: 'https://evil.test/logo.png' }).success);
  assert.ok(brandSchema.safeParse({ name: 'HP', logo: '' }).success);
  const sub = (p256dh, auth) => ({ subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh, auth } } });
  assert.ok(!pushSubscribeSchema.safeParse(sub('junk', 'junk')).success);
  assert.ok(pushSubscribeSchema.safeParse(sub('B' + 'a'.repeat(86), 'c'.repeat(22))).success);
});

test('#14 phone lookups use an indexed key (orders and guests), with the old pattern only for older records', async () => {
  const { Order } = require(dist('models/Order.js'));
  const order = new Order({ orderNumber: 'BRX-1', shippingAddress: { fullName: 'A', line1: 'x', city: 'Rabat', phone: '+212 6 12 34 56 78' }, items: [], pricing: { subtotal: 1, discount: 0, shipping: 0, tax: 0, total: 1 } });
  await order.validate().catch(() => undefined);
  assert.equal(order.phoneKey, '612345678');
  assert.ok(Order.schema.indexes().some(([k]) => k.phoneKey === 1));
  assert.ok(read('backend/src/services/auth.service.ts').includes('$or: [{ phoneKey: digits.slice(-9) }, { phoneKey: null, phone: rx }]'));
});

test('#15 newsletter: the same answer whether already subscribed or not', () => {
  assert.ok(!read('api/v1/contact.js').includes("'Already subscribed'"));
  assert.ok(!read('backend/src/controllers/misc.controller.ts').includes("'Already subscribed'"));
});
