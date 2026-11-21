// Staff choose ANY order status (forwards, or back to fix a mistake); stock and payment follow:
// jumping ahead reserves / takes the stock out and collects the cash, going back from delivered
// un-collects it, back to pending gives the reservation back; confirming before the deposit only
// when staff said so (noted); the delivery-failed reason is optional; returned stays with the
// returned-items form; the customer's own cancel is still pending-only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, dist, setTestEnv, fakeModule } = require('./_helpers.cjs');
setTestEnv();

const calls = [];
fakeModule(dist('services/orderStock.service.js'), {
  reserveOrderStock: async () => calls.push('reserve'),
  // Like the real one: nothing when the stock already left
  dispatchOrderStock: async (o) => {
    if (o.stockDispatched) return;
    calls.push('dispatch');
    o.stockDispatched = true;
  },
  releaseOrderStock: async (o) => {
    if (!o.stockDispatched) calls.push('release');
  },
});

const { Order } = require(dist('models/Order'));
const orders = require(dist('services/order.service'));

let doc;
const make = (extra = {}) => {
  doc = new Order({
    orderNumber: 'BRX-1',
    items: [],
    shippingAddress: { fullName: 'Salma', line1: 'x', city: 'Rabat', phone: '0612345678' },
    pricing: { subtotal: 1000, shipping: 0, discount: 0, tax: 0, total: 1000 },
    paymentStatus: 'pending',
    orderStatus: 'pending',
    stockReserved: false,
    ...extra,
  });
  calls.length = 0;
  return doc;
};
Order.findById = () => ({ select: async () => doc });
Order.prototype.save = async function () {
  return this;
};
const move = (status, extra = {}) => orders.updateOrderStatus(String(doc._id), status, undefined, undefined, { silent: true, ...extra });

test('pending → delivered in one click: stock reserved and taken out, cash collected', async () => {
  make();
  await move('delivered');
  assert.deepEqual(calls, ['reserve', 'dispatch']);
  assert.equal(doc.orderStatus, 'delivered');
  assert.equal(doc.paymentStatus, 'paid');
  assert.ok(doc.deliveredAt);
});

test('back from delivered (a correction): the cash is no longer counted as collected', async () => {
  make({ orderStatus: 'delivered', paymentStatus: 'paid', deliveredAt: new Date(), stockReserved: true, stockDispatched: true });
  await move('shipped');
  assert.equal(doc.orderStatus, 'shipped');
  assert.equal(doc.paymentStatus, 'pending');
  assert.equal(doc.deliveredAt, undefined);
  assert.deepEqual(calls, [], 'the stock is already out: nothing moves');
});

test('confirmed → pending gives the reservation back', async () => {
  make({ orderStatus: 'confirmed', stockReserved: true });
  await move('pending');
  assert.deepEqual(calls, ['release']);
  assert.equal(doc.stockReserved, false);
});

test('deposit not received: confirm only when staff chose to, and it is noted', async () => {
  make({ deposit: { required: true, amount: 300, status: 'pending' } });
  await assert.rejects(move('confirmed'), /deposit/i);
  await move('confirmed', { depositOverride: true });
  assert.equal(doc.orderStatus, 'confirmed');
  assert.ok(doc.timeline.some((t) => t.internal && /without the deposit/.test(t.note)));
});

test('delivery failed needs no reason; returned stays with the returned-items form', async () => {
  make({ orderStatus: 'shipped', stockReserved: true, stockDispatched: true });
  await move('delivery_failed');
  assert.equal(doc.orderStatus, 'delivery_failed');
  assert.equal(doc.deliveryIssue.reason, 'other');
  await assert.rejects(move('returned'), /Returned items/);
});

test('the customer still cancels pending orders only', async () => {
  Order.findOne = async () => make({ orderStatus: 'shipped' });
  await assert.rejects(orders.cancelUserOrder('u1', 'BRX-1'), /Only pending orders/);
});

test('order page: every status clickable, current marked, warnings instead of blocks, no required note', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'frontend/src/components/admin/OrderWorkflow.tsx'), 'utf8');
  assert.match(ui, /disabled=\{isCurrent\}/, 'only the current status is not a button to press');
  assert.doesNotMatch(ui, /cursor-not-allowed/, 'nothing greyed out');
  assert.match(ui, /depositOverride: true/);
  assert.match(ui, /reason: undefined as string \| undefined/, 'the reason is optional');
  assert.match(ui, /document\.getElementById\('order-returns'\)/, 'returned opens the returned-items section');
});
