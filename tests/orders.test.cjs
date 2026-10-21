// Order numbers, guest tracking and who may delete an order (security fixes #5 and order deletion).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Order } = require(dist('models/Order'));
const { DepositProof } = require(dist('models/DepositProof'));
const { DepositReceipt } = require(dist('models/DepositReceipt'));
const { Notification } = require(dist('models/Notification'));
const svc = require(dist('services/order.service'));

test('order numbers: BRX-YYYYMMDD-XXXXXX, no look-alike characters, almost never repeated', () => {
  const nums = Array.from({ length: 20000 }, () => svc.generateOrderNumber());
  assert.ok(nums.every((n) => /^BRX-\d{8}-[A-HJ-NP-Z2-9]{6}$/.test(n)));
  // ~1e9 codes per day: a repeat in 20,000 happens about 1 run in 5 (birthday maths), so allow a couple
  assert.ok(nums.length - new Set(nums).size <= 2);
});

test('guest tracking: the whole phone number must match (any common format)', async () => {
  const stored = { orderNumber: 'BRX-20261021-K7M2QX', shippingAddress: { phone: '06 12 34 56 78' } };
  Order.findOne = async (q) => (q.$or.some((c) => c.orderNumber === stored.orderNumber) ? stored : null);
  const found = async (num, phone) => {
    try {
      await svc.trackGuestOrder(num, phone);
      return true;
    } catch {
      return false;
    }
  };
  for (const p of ['0612345678', '+212612345678', '00212612345678', '212 6 12 34 56 78', '+212 (0)6 12 34 56 78']) assert.ok(await found('BRX-20261021-K7M2QX', p), p);
  assert.ok(await found('brx-20261021-k7m2qx', '0612345678'), 'lowercase order number');
  assert.equal(await found('BRX-20261021-K7M2QX', '0612345679'), false, 'different phone');
  assert.equal(await found('BRX-20261021-K7M2QX', '12345678'), false, 'last 8 digits only');
  assert.equal(await found('BRX-20261021-K7M2QY', '0612345678'), false, 'wrong order number');
});

test('deleting orders: staff only when no money moved; the owner always; photos go too', async () => {
  const id = '64b000000000000000000001';
  let current;
  const deleted = [];
  let photosDeleted = 0;
  Order.findById = async () => current;
  Order.deleteOne = async () => deleted.push(current.orderNumber);
  DepositProof.deleteMany = async () => photosDeleted++;
  DepositReceipt.deleteMany = async () => ({});
  Notification.deleteMany = async () => ({});
  const base = { _id: id, orderNumber: 'BRX-1', orderStatus: 'pending', paymentStatus: 'pending', refunds: [], stockReserved: false };
  const tryDelete = async (o, isOwner) => {
    current = { ...base, ...o };
    try {
      await svc.deleteOrder(id, { isOwner });
      return 'deleted';
    } catch (e) {
      return e.message;
    }
  };
  assert.equal(await tryDelete({}, false), 'deleted');
  assert.equal(await tryDelete({ orderStatus: 'cancelled' }, false), 'deleted');
  for (const o of [
    { orderStatus: 'delivered', deliveredAt: new Date() },
    { orderStatus: 'returned', deliveredAt: new Date() },
    { orderStatus: 'shipped' },
    { deposit: { status: 'received', amount: 200 } },
    { paymentStatus: 'paid' },
    { orderStatus: 'cancelled', refunds: [{ amount: 50 }] },
  ]) {
    assert.match(await tryDelete(o, false), /only the owner can delete it/, JSON.stringify(o));
  }
  assert.equal(await tryDelete({ orderStatus: 'delivered', deliveredAt: new Date() }, true), 'deleted');
  assert.equal(photosDeleted, deleted.length);
  await assert.rejects(svc.deleteOrder('xyz', {}), /not found/);
});
