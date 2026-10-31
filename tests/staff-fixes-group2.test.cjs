// Scan fixes, group 2 (staff work):
// 9  a pending order keeps its coupon when the customer edits it, even if the coupon expired or ran out since;
// 10 a parcel partly sent back before delivery can still be marked delivered for the part kept;
// 11 a value that must be unique (SKU, email, code…) is a 409 with a clear message, never a 500;
// 12 staff who may only look at customers do not see edit buttons;
// 13 the same product on two lines of one return cannot return more than was sold;
// 14 a settings save on the live site checks every row like the local server (no silent drops).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('9: an order that already holds a coupon keeps it after the coupon expired or ran out', async () => {
  const { Coupon } = require(dist('models/Coupon.js'));
  const svc = require(dist('services/order.service.js'));
  const queries = [];
  Coupon.findOne = async (q) => {
    queries.push(q);
    return { _id: 'c1', code: 'RAMADAN10', type: 'percent', value: 10, minOrder: 0, maxUses: 1, usedCount: 1, isActive: false, expiresAt: new Date('2020-01-01') };
  };
  await assert.rejects(svc.validateCoupon('ramadan10', 1000), /expired|limit/i, 'new orders still refused');
  const { discount } = await svc.validateCoupon('ramadan10', 1000, [], { alreadyGranted: true });
  assert.equal(discount, 100);
  assert.equal('isActive' in queries[1], false, 'a coupon switched off since still applies to the order');
  assert.match(src('backend/src/services/order.service.ts'), /orderItems,\n\s+\{ alreadyGranted: true \}\n\s+\);/);
});

test('10: partly returned before delivery → can be marked delivered (server and admin agree)', () => {
  const server = require(dist('utils/orderStatus.js'));
  assert.ok(server.ORDER_TRANSITIONS.partially_returned.includes('delivered'));
  const front = src('frontend/src/lib/orderStatus.ts');
  assert.match(front, /partially_returned: \['delivered', 'return_requested', 'return_in_transit'\]/);
  // Already delivered (cash collected): refused, and the button is not offered
  assert.match(src('backend/src/services/order.service.ts'), /prev === 'partially_returned' && orderStatus === 'delivered' && wasDelivered\(order\)/);
  assert.match(src('frontend/src/components/admin/OrderWorkflow.tsx'), /current === 'partially_returned' && s === 'delivered' && order\.deliveredAt/);
});

test('11: duplicate values are a 409 with a clear message on the live site and locally', () => {
  const { duplicateKeyMessage } = require(dist('utils/duplicateKey.js'));
  const dup = (keyPattern) => Object.assign(new Error('E11000 duplicate key'), { code: 11000, keyPattern });
  assert.equal(duplicateKeyMessage(dup({ sku: 1 })), 'This SKU is already used by another product');
  assert.equal(duplicateKeyMessage(dup({ email: 1 })), 'This email is already registered');
  assert.equal(duplicateKeyMessage(dup({ weird: 1 })), 'This already exists');
  assert.equal(duplicateKeyMessage(new Error('other')), null);

  const { sendError } = require(api('_lib/http.js'));
  const reply = (err) => {
    const res = { headers: {}, setHeader() {}, end(b) { this.body = JSON.parse(b); } };
    sendError(res, err);
    return res;
  };
  const r = reply(dup({ code: 1 }));
  assert.equal(r.statusCode, 409);
  assert.equal(r.body.message, 'This code is already used');
  const crash = reply(new Error('connection to 10.0.0.1 lost'));
  assert.equal(crash.statusCode, 500);
  assert.doesNotMatch(crash.body.message, /10\.0\.0\.1/, 'server details still hidden');
  assert.match(src('backend/src/middleware/errorHandler.ts'), /duplicateKeyMessage\(err\)/);
});

test('12: customer profile shows edit buttons only to staff who may change customers', () => {
  const page = src('frontend/src/pages/admin/CustomerProfile.tsx');
  assert.match(page, /const canEdit = hasPermission\(role, 'customers:write'\)/);
  const editBlock = page.slice(page.indexOf('{canEdit ? ('), page.indexOf("setConfirm('delete')"));
  assert.match(editBlock, /^\{canEdit \? \(\n\s+<>\n/);
  assert.match(editBlock, /setPasswordLink\(true\)[\s\S]*<Button size="sm" variant="outline" onClick=\{\(\) => setConfirm\('toggle'\)\}>/);
  assert.match(page, /canEdit=\{canEdit\}/);
  const cards = src('frontend/src/components/admin/customers/ProfileOverview.tsx');
  assert.equal((cards.match(/canEdit=\{canEdit\}/g) || []).length, 5, 'every card gets it');
  assert.equal((cards.match(/editing \|\| !canEdit \? null/g) || []).length, 2);
});

test('13: one return cannot list the same product twice to send back more than was sold', async () => {
  const mongoose = require(path.join(ROOT, 'backend/node_modules/mongoose'));
  mongoose.startSession = async () => ({ withTransaction: async (fn) => fn(), endSession: async () => {} });
  const { Order } = require(dist('models/Order.js'));
  const { CustomerReturn } = require(dist('models/Inventory.js'));
  const chain = (v) => ({ select: () => chain(v), session: () => chain(v), lean: async () => v, then: (r, j) => Promise.resolve(v).then(r, j) });
  const order = { _id: 'o1', orderNumber: 'BRX-1', orderStatus: 'delivered', items: [{ product: 'p1', name: 'HP EliteBook', qty: 1 }] };
  Order.findById = () => chain(order);
  CustomerReturn.find = () => chain([]);
  CustomerReturn.create = async () => {
    throw Object.assign(new Error('reached'), { statusCode: 418 });
  };
  const { createReturn } = require(dist('services/inventoryOps.service.js'));
  const line = { productId: 'p1', qty: 1, reason: 'Broken screen' };
  await assert.rejects(createReturn({ orderId: 'o1', lines: [line, line] }, { id: 'u1' }), (e) => e.statusCode === 400);
  await assert.rejects(createReturn({ orderId: 'o1', lines: [line] }, { id: 'u1' }), (e) => e.statusCode === 418, 'one line is fine');
});

test('14: settings rows are checked on the live site like locally, with a readable message', () => {
  const { settingsUpdateSchema: S, settingsIssueMessage } = require(dist('validators/schemas.js'));
  assert.ok(S.safeParse({ storeName: 'Brynoxa', supportEmail: '', wholesaleTiers: [{ name: 'Gold', discountPercent: 10 }] }).success);
  const bad = S.safeParse({ wholesaleTiers: [{ name: 'Gold', discountPercent: 10 }, { name: '', discountPercent: 10 }] });
  assert.equal(bad.success, false);
  assert.match(settingsIssueMessage(bad.error.issues[0]), /^Wholesale tiers, row 2 — name: /);
  assert.equal(S.safeParse({ taxRate: -1 }).success, false, 'plain values keep the stricter rules');
  assert.match(src('api/v1/settings.js'), /settingsUpdateSchema\.safeParse\(body \?\? \{\}\)/);
  assert.match(src('backend/src/routes/commerce.routes.ts'), /validate\(settingsUpdateSchema\)/);
});
