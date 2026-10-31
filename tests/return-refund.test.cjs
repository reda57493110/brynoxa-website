// "Return & refund": a delivered sale undone in one step (Ahmed bought a 5,000 DH laptop, found a
// problem 2 months later, gets his money back and gives the laptop back).
// - checked before anything changes: delivered only, amount within what was paid, write-off rights;
// - then the return, the refund (with how it was paid back) and the stock move, in that order;
// - money: the sale stays on its day; the refund, the product back and a write-off count on the
//   day they happen (past months do not change).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Order } = require(dist('models/Order.js'));
const ops = require(dist('services/inventoryOps.service.js'));
const orders = require(dist('services/order.service.js'));
const { returnAndRefund } = require(dist('services/returnRefund.service.js'));

const delivered = () => ({
  _id: 'o1',
  orderNumber: 'BRX-1',
  orderStatus: 'delivered',
  deliveredAt: new Date('2026-08-29'),
  pricing: { total: 5000 },
  refunds: [],
  items: [{ product: 'p1', name: 'HP EliteBook', qty: 1, price: 5000 }],
});
const chain = (v) => ({ select: () => chain(v), then: (r, j) => Promise.resolve(v).then(r, j) });
const ahmed = { lines: [{ productId: 'a'.repeat(24), qty: 1 }], reason: 'defective', note: 'Screen flickers', amount: 5000, method: 'cash', outcome: 'inspect' };

function record() {
  const calls = [];
  ops.createReturn = async (input) => {
    calls.push(['return', input]);
    return { _id: 'r1', lines: [{ _id: 'l1', qty: 1, serials: [] }] };
  };
  orders.recordRefund = async (id, input) => calls.push(['refund', input]);
  ops.assessReturn = async (id, input) => calls.push(['assess', input]);
  return calls;
}

test('checked first: only delivered orders, at most what was paid, write-off needs approval rights', async () => {
  const calls = record();
  Order.findById = () => chain({ ...delivered(), orderStatus: 'shipped', deliveredAt: undefined });
  await assert.rejects(returnAndRefund('o1', ahmed, { id: 'u1', canApprove: true }), /Only delivered orders/);
  Order.findById = () => chain(delivered());
  await assert.rejects(returnAndRefund('o1', { ...ahmed, amount: 5001 }, { id: 'u1', canApprove: true }), /between 0 and 5,000 DH/);
  await assert.rejects(returnAndRefund('o1', { ...ahmed, outcome: 'write-off' }, { id: 'u1', canApprove: false }), (e) => e.statusCode === 403);
  assert.equal(calls.length, 0, 'nothing changed');
});

test('Ahmed: the laptop comes back, 5,000 DH paid back in cash, the laptop waits to be checked', async () => {
  const calls = record();
  Order.findById = () => chain(delivered());
  await returnAndRefund('o1', ahmed, { id: 'u1', canApprove: false });
  assert.deepEqual(calls.map((c) => c[0]), ['return', 'refund'], 'no stock decision yet: checked later');
  assert.match(calls[0][1].lines[0].reason, /^Defective \/ problem: Screen flickers$/);
  assert.equal(calls[1][1].amount, 5000);
  assert.equal(calls[1][1].method, 'cash');
  assert.equal(calls[1][1].itemsReturned, true);
});

test('back on sale, written off, or an exchange with no money back', async () => {
  let calls = record();
  Order.findById = () => chain(delivered());
  await returnAndRefund('o1', { ...ahmed, outcome: 'restock' }, { id: 'u1', canApprove: false });
  assert.equal(calls[2][1].outcome, 'restock-new');
  assert.equal(calls[2][1].meetsNewCriteria, true);
  calls = record();
  await returnAndRefund('o1', { ...ahmed, outcome: 'write-off' }, { id: 'u1', canApprove: true });
  assert.equal(calls[2][1].outcome, 'write-off');
  calls = record();
  await returnAndRefund('o1', { ...ahmed, amount: 0 }, { id: 'u1', canApprove: false });
  assert.deepEqual(calls.map((c) => c[0]), ['return'], 'no refund recorded for 0 DH');
});

test('money: the sale stays on its day; refund, product back and write-off on the day they happen', () => {
  const profit = require(dist('services/profit.service.js'));
  const courier = { delivered: 30, returned: 30 };
  // The order 2 months ago, already refunded and returned: on its own day it is still the 5,000 DH sale
  const order = { ...delivered(), createdAt: new Date('2026-08-27'), pricing: { total: 5000, shipping: 0, discount: 0 }, refunds: [{ amount: 5000, at: new Date() }], items: [{ product: 'p1', name: 'HP', qty: 1, price: 5000, unitCost: 4000, returnedQty: 1 }] };
  const row = profit.orderFigures(order, courier, new Map());
  assert.equal(row.kind, 'sale');
  assert.equal(row.moneyIn, 5000);
  assert.equal(row.productCost, 4000);
  assert.equal(row.profit, 970);
  // August: the sale, unchanged by what happened in October
  assert.equal(profit.totalsOf([row], 0, []).netProfit, 970);
  // October: 5,000 DH given back, the laptop's 4,000 DH cost back in stock → −1,000 DH
  const october = [
    { type: 'refund', amount: 5000, day: '2026-10-31' },
    { type: 'returned', amount: 4000, day: '2026-10-31' },
  ];
  const oct = profit.totalsOf([], 0, october);
  assert.equal(oct.moneyIn, -5000);
  assert.equal(oct.refundsAfterSale, 5000);
  assert.equal(oct.netProfit, -1000);
  // Broken: written off too → the laptop's cost is lost as well
  assert.equal(profit.totalsOf([], 0, [...october, { type: 'write-off', amount: 4000, day: '2026-10-31' }]).netProfit, -5000);
  // Over both months together: the 30 DH delivery and the 4,000 DH laptop are what the sale cost
  assert.equal(profit.totalsOf([row], 0, [...october, { type: 'write-off', amount: 4000 }]).netProfit, -4030);
});

test('route, activity log, dashboard dating, buttons', () => {
  assert.match(fs.readFileSync(dist('routes/customer.routes.js'), 'utf8'), /router\.post\('\/admin\/orders\/:id\/return-refund', auth_1\.requireAuth, \(0, auth_1\.requirePermission\)\('orders:write'\)/);
  const { describeStaffAction } = require(dist('utils/staffActions.js'));
  if (describeStaffAction) assert.match(JSON.stringify(describeStaffAction('POST', 'admin/orders/abc/return-refund')), /Returned a sale and refunded it/);
  const dash = fs.readFileSync(path.join(ROOT, 'backend/src/services/dashboard.service.ts'), 'utf8');
  assert.match(dash, /if \(a\.type === 'refund'\) row\.revenue -= a\.amount;/);
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  assert.match(src('pages/admin/OrderDetail.tsx'), /<ReturnRefundButton order=\{o\}/);
  assert.equal((src('components/admin/customers/ProfileOrders.tsx').match(/<ReturnRefundButton orderId=\{ord\._id\} \/>/g) || []).length, 2, 'phones and computers');
  assert.match(src('components/admin/ReturnRefundDialog.tsx'), /past the \{RETURN_DAYS\}-day return period/);
  assert.ok(fs.existsSync(api('v1/admin.js')));
});

test('on the live site the request reaches the server code (not "Method not allowed")', async () => {
  const { fakeModule, callHandler } = require('./_helpers.cjs');
  const handled = [];
  fakeModule(dist('app.js'), {
    getApp: () => (req, res) => {
      handled.push(req.url);
      res.statusCode = 200;
      res.end('{"success":true}');
    },
  });
  fakeModule(api('_lib/mongo.js'), { connectMongo: async () => ({}) });
  const admin = require(api('v1/admin.js'));
  const listeners = {};
  const res = { statusCode: 0, headers: {}, setHeader() {}, on(ev, fn) { listeners[ev] = fn; }, end(b) { this.body = b; listeners.finish && listeners.finish(); } };
  await admin({ method: 'POST', url: '/api/v1/admin?__route=orders/abc/return-refund', query: { __route: 'orders/abc/return-refund' }, headers: {}, socket: {} }, res);
  assert.deepEqual(handled, ['/api/v1/admin/orders/abc/return-refund']);
  assert.equal(res.statusCode, 200);
  void callHandler;
});
