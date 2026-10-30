// Scan fixes, group 5 (for a growing shop):
// - per-customer coupon limits counted in the database (no 5000-order cap), with a short lock so
//   two orders at the same moment cannot both use a "once per customer" coupon;
// - every model's indexes reach the database; read notifications are removed after 6 months;
// - photos: in use = product, category or brand; abandoned Cloudinary uploads and replaced
//   category / brand photos are deleted;
// - customers page reads one page in the usual view; dashboard counts use indexes;
// - money: coupon, tax and total rounded to the centime the same way in the shop and on the server;
//   covered transfer fees never exceed what is left after the deposit.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('per-customer coupons: counted in the database, by account or phone, with a lock for same-moment orders', async () => {
  const mongoose = require(path.join(ROOT, 'backend/node_modules/mongoose'));
  const { Order } = require(dist('models/Order.js'));
  const svc = require(dist('services/order.service.js'));
  const queries = [];
  Order.countDocuments = async (q) => (queries.push(q), 0);
  // A fake lock store: the second order at the same moment finds the lock taken
  const locks = new Map();
  const db = {
    collection: () => ({
      insertOne: async (doc) => {
        if (locks.has(doc._id)) throw Object.assign(new Error('dup'), { code: 11000 });
        locks.set(doc._id, doc);
      },
      deleteMany: async ({ _id }) => _id.$in.forEach((id) => locks.delete(id)),
    }),
  };
  Object.defineProperty(mongoose.connection, 'db', { value: db, configurable: true });
  // First order: counted (by account or phone), lock taken
  const taken = await svc.assertCouponPerCustomer('c1', 1, 'u1', '06 12 34 56 78');
  assert.deepEqual(queries[0].$or, [{ user: 'u1' }, { 'coupon.phoneKey': '612345678' }]);
  assert.deepEqual(taken, ['couponUse:c1:user:u1:0', 'couponUse:c1:phone:612345678:0']);
  // Second order at the same moment (same phone, other account): refused, nothing left behind
  await assert.rejects(svc.assertCouponPerCustomer('c1', 1, 'u2', '+212 612-345678'), /already used this coupon/);
  assert.equal(locks.size, 2);
  // The order could not be created: the locks go, so the customer can try again at once
  await svc.releaseCouponLocks(taken);
  assert.equal(locks.size, 0);
  // Already used on an order: refused without any lock
  Order.countDocuments = async () => 1;
  await assert.rejects(svc.assertCouponPerCustomer('c1', 1, 'u1', '0612345678'), /already used this coupon/);
  assert.equal((await svc.assertCouponPerCustomer('c1', 0, 'u1')).length, 0, 'no limit: nothing to check');
  Object.defineProperty(mongoose.connection, 'db', { value: undefined, configurable: true });
  const src = read('backend/src/services/order.service.ts');
  assert.doesNotMatch(src, /\.limit\(5000\)/);
  assert.match(read('backend/src/models/Order.ts'), /index\(\{ 'coupon\.couponId': 1, 'coupon\.phoneKey': 1 \}/);
});

test('indexes: every model is synced; read notifications expire after 6 months', () => {
  const db = read('backend/src/config/db.ts');
  for (const f of fs.readdirSync(path.join(ROOT, 'backend/src/models'))) {
    assert.match(db, new RegExp(`import\\('\\.\\./models/${f.replace('.ts', '')}'\\)`), f);
  }
  const { Notification } = require(dist('models/Notification.js'));
  const ttl = Notification.schema.indexes().find(([, o]) => o.expireAfterSeconds);
  assert.equal(ttl[1].expireAfterSeconds, 180 * 24 * 3600);
  assert.deepEqual(ttl[1].partialFilterExpression, { isRead: true });
});

test('photos: Cloudinary addresses map to their id; category and brand photos count as in use', () => {
  const up = require(dist('services/upload.service.js'));
  assert.equal(up.publicIdFromUrl('https://res.cloudinary.com/jpnvria0/image/upload/v1730000000/brynoxa/abc123.jpg'), 'brynoxa/abc123');
  assert.equal(up.publicIdFromUrl('https://res.cloudinary.com/jpnvria0/image/upload/c_limit,w_800/v1/brynoxa/x.webp'), 'brynoxa/x');
  assert.equal(up.publicIdFromUrl('/api/v1/images/' + 'a'.repeat(24)), 'db_' + 'a'.repeat(24));
  assert.equal(up.publicIdFromUrl('https://example.com/photo.jpg'), null, 'photos hosted elsewhere are never deleted');
  const src = read('backend/src/services/upload.service.ts');
  assert.match(src, /Category\.distinct\('image'\)/);
  assert.match(src, /Brand\.distinct\('logo'\)/);
  assert.match(src, /pendingUploads\(\)\s*\?\.insertOne/);
  const catalog = read('backend/src/services/catalog.service.ts');
  assert.equal((catalog.match(/await deleteReplacedImage\(/g) || []).length, 4, 'category edit / delete, brand edit / delete');
});

test('customers page: the usual view reads one page; dashboard counts use indexes', () => {
  const c = read('backend/src/services/customerAnalytics.service.ts');
  assert.match(c, /\.skip\(\(page - 1\) \* limit\)\s*\.limit\(limit\)/);
  assert.match(c, /listCustomerOverview\(\{ \.\.\.query, page: 1, limit: 100 \}, canSeeProfit, \{ everything: true \}\)/, 'CSV export still has everyone');
  const a = read('backend/src/services/admin.service.ts');
  assert.doesNotMatch(a.slice(0, a.indexOf('User.countDocuments')), /Order\.aggregate\(\[\s*\{\s*\$facet/);
  assert.match(a, /Order\.countDocuments\(attentionFilter\(\)\)/);
});

test('money: rounded to the centime the same way in the shop and on the server; covered fees capped', async () => {
  const { Coupon } = require(dist('models/Coupon.js'));
  const svc = require(dist('services/order.service.js'));
  Coupon.findOne = async () => ({ code: 'TEN', type: 'percent', value: 10, minOrder: 0, maxUses: 0, usedCount: 0, isActive: true });
  assert.equal((await svc.validateCoupon('ten', 3333.33)).discount, 333.33);
  assert.match(read('frontend/src/pages/store/Checkout.tsx'), /const tax = Math\.round\(\(\(taxable \* taxRate\) \/ 100\) \* 100\) \/ 100/);
  assert.match(read('backend/src/services/order.service.ts'), /const total = roundMoney\(taxable \+ shipping \+ tax\);/);
  const delivered = { orderStatus: 'delivered', deliveredAt: new Date(), pricing: { total: 1000 }, deposit: { amount: 900, status: 'received', feeCredit: 300 } };
  assert.equal(svc.amountPaidOnOrder(delivered), 900, 'fees covered never more than the 100 DH left');
});
