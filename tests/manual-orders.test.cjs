// Orders from social media, the phone or the shop, entered by staff: same lines and money rules
// as website orders, the source is kept, customers without an email are never emailed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { api, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Product } = require(dist('models/Product'));
const { Order } = require(dist('models/Order'));
const { User } = require(dist('models/User'));
const settingsModel = require(dist('models/Settings'));
const orders = require(dist('services/order.service'));
const { manualOrderSchema } = require(dist('validators/schemas'));
const { originFilter } = require(dist('utils/orderOrigin'));

const P1 = '64c000000000000000000001';
const P2 = '64c000000000000000000002';
const products = [
  { _id: P1, name: 'Laptop', sku: 'L1', price: 5000, stock: 3, isActive: true, images: [], costPrice: 4000 },
  // Hidden in the shop: staff can still sell it
  { _id: P2, name: 'Old mouse', sku: 'M1', price: 100, stock: 1, isActive: false, images: [] },
];
let productQuery;
Product.find = (q) => {
  productQuery = q;
  return { select: async () => products.filter((p) => q._id.$in.includes(p._id)) };
};
settingsModel.getSettings = async () => ({ taxRate: 0 });
settingsModel.getSettingsCached = async () => ({ taxRate: 0 });
const created = [];
Order.create = async (doc) => {
  created.push(doc);
  return { ...doc, _id: 'o1' };
};
let users = [];
const newUsers = [];
User.findOne = (q) => {
  const found = users.find((u) => (q.email ? u.email === q.email : q.phone.test(u.phone)));
  const result = Promise.resolve(found || null);
  result.sort = () => result;
  return result;
};
User.create = async (doc) => {
  newUsers.push(doc);
  return { ...doc, _id: 'u-new' };
};

const base = {
  origin: 'instagram',
  items: [{ productId: P1, qty: 1 }],
  customer: { fullName: 'Salma', phone: '06 12 34 56 78', city: 'Rabat' },
};

test('the form: website is not a choice, sizes are bounded, defaults filled in', () => {
  assert.equal(manualOrderSchema.safeParse({ ...base, origin: 'website' }).success, false);
  assert.equal(manualOrderSchema.safeParse({ ...base, items: Array(51).fill(base.items[0]) }).success, false);
  const ok = manualOrderSchema.parse({ ...base, origin: 'store' });
  assert.equal(ok.status, 'pending');
  assert.equal(ok.shipping, 0);
});

test('agreed price, discount capped at the products, hidden products allowed, source kept', async () => {
  created.length = 0;
  users = [];
  await orders.createManualOrder(
    { ...base, items: [{ productId: P1, qty: 2, price: 4500 }, { productId: P2, qty: 1 }], discount: 99999, shipping: 30 },
    'staff1'
  );
  const o = created[0];
  assert.equal(productQuery.isActive, undefined, 'hidden products are not filtered out');
  assert.equal(o.items[0].price, 4500);
  assert.equal(o.items[0].listPrice, 5000);
  assert.equal(o.items[0].unitCost, 4000, 'cost kept for Profit');
  assert.equal(o.pricing.subtotal, 9100);
  assert.equal(o.pricing.discount, 9100);
  assert.equal(o.pricing.total, 30);
  assert.equal(o.origin, 'instagram');
  assert.equal(o.createdBy, 'staff1');
  assert.equal(o.costs, undefined, 'courier: the default price');
  assert.match(o.timeline[0].note, /from Instagram/);
});

test('a sale in the shop costs no courier; not enough stock is refused', async () => {
  created.length = 0;
  await orders.createManualOrder({ ...base, origin: 'store' }, 'staff1');
  assert.deepEqual(created[0].costs, { delivery: 0 });
  await assert.rejects(orders.createManualOrder({ ...base, items: [{ productId: P1, qty: 4 }] }, 'staff1'), /Insufficient stock/);
});

test('customer: found by phone written another way, else a guest that is never emailed', async () => {
  created.length = 0;
  newUsers.length = 0;
  users = [{ _id: 'u-old', phone: '+212612345678', role: 'customer' }];
  await orders.createManualOrder(base, 'staff1');
  assert.equal(created[0].user, 'u-old');
  assert.equal(newUsers.length, 0);

  users = [];
  await orders.createManualOrder(base, 'staff1');
  assert.match(newUsers[0].email, /^phone-612345678-[0-9a-f]{8}@no-email\.invalid$/);
  assert.equal(newUsers[0].isGuest, true);

  assert.equal(newUsers[0].source, 'instagram', 'shown as "Salma / Guest Instagram"');

  // No name: "Guest TikTok"
  newUsers.length = 0;
  created.length = 0;
  await orders.createManualOrder({ ...base, origin: 'tiktok', customer: { ...base.customer, fullName: '' } }, 'staff1');
  assert.equal(newUsers[0].name, 'Guest TikTok');
  assert.equal(created[0].shippingAddress.fullName, 'Guest TikTok');

  users = [{ _id: 'u-staff', email: 'boss@shop.test', role: 'admin' }];
  await assert.rejects(
    orders.createManualOrder({ ...base, customer: { ...base.customer, email: 'boss@shop.test' } }, 'staff1'),
    /staff account/
  );
});

test('the email sender skips ".invalid" addresses', () => {
  const src = fs.readFileSync(dist('services/email.service.js'), 'utf8');
  assert.match(src, /\\\.invalid\$\/i\.test/);
});

test('orders list: filter by source (old orders count as website)', () => {
  assert.deepEqual(originFilter('website'), { origin: { $in: ['website', null] } });
  assert.deepEqual(originFilter('other_channels'), { origin: { $nin: ['website', null] } });
  assert.deepEqual(originFilter('store'), { origin: 'store' });
  assert.equal(originFilter('nonsense'), undefined);
});

test('server function: staff with order rights, same validation as Express', () => {
  const src = fs.readFileSync(api('v1/admin.js'), 'utf8');
  assert.match(src, /route === 'orders' && req\.method === 'POST'\) \{\s+const user = await requireStaff\(req, res, \['orders:write'\]\);/);
  assert.match(src, /validated\('manualOrderSchema'/);
});
