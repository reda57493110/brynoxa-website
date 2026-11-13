// Fake cash-on-delivery orders: blocked numbers cannot order on the website (both order paths,
// before an account is made), and an order page shows what the number's other orders say.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('a blocked number is refused however it is written; others pass', async () => {
  const { BlockedPhone } = require(dist('models/BlockedPhone.js'));
  const guard = require(dist('services/phoneGuard.service.js'));
  const orig = BlockedPhone.exists;
  let asked;
  BlockedPhone.exists = async (q) => {
    asked = q.key;
    return q.key === '612345678' ? { _id: 'x' } : null;
  };
  try {
    for (const p of ['06 12 34 56 78', '+212 6 12-34-56-78', '00212612345678']) {
      await assert.rejects(() => guard.assertPhoneAllowed(p), (e) => e.statusCode === 403 && e.code === 'PHONE_BLOCKED', p);
      assert.equal(asked, '612345678');
    }
    await guard.assertPhoneAllowed('0698765432');
    await guard.assertPhoneAllowed('');
  } finally {
    BlockedPhone.exists = orig;
  }
});

test('if the check cannot run, the order still goes through (fails open, like the rate limits)', async () => {
  const { BlockedPhone } = require(dist('models/BlockedPhone.js'));
  const guard = require(dist('services/phoneGuard.service.js'));
  const orig = BlockedPhone.exists;
  const origErr = console.error;
  BlockedPhone.exists = async () => {
    throw new Error('db down');
  };
  console.error = () => {};
  try {
    await guard.assertPhoneAllowed('0612345678');
  } finally {
    BlockedPhone.exists = orig;
    console.error = origErr;
  }
});

test('both website order paths check the number first; staff orders are not blocked', () => {
  const ctrl = read('backend/src/controllers/order.controller.ts');
  assert.ok(ctrl.indexOf('await assertPhoneAllowed(shippingAddress?.phone);') < ctrl.indexOf('authService.resolveCheckoutCustomer'), 'before the account is made');
  const fn = read('api/v1/orders.js');
  assert.ok(fn.indexOf(".assertPhoneAllowed(shippingAddress?.phone);") > 0 && fn.indexOf('.assertPhoneAllowed(shippingAddress?.phone);') < fn.indexOf('authService.resolveCheckoutCustomer'), 'live site, before the account');
  assert.ok(read('backend/src/services/order.service.ts').includes('  await assertPhoneAllowed(input.shippingAddress?.phone);\n'), 'and in the order itself');
  // customers read the message in their language
  const msgs = read('frontend/src/lib/serverMessages.ts');
  assert.ok(msgs.includes("'This order cannot be placed online. Please contact us on WhatsApp.': 'server.orderBlocked',"));
  for (const l of ['en', 'fr', 'ar']) assert.ok(read(`frontend/src/i18n/${l}.ts`).includes('    orderBlocked: '), l);
});

test("a number's history: delivered, refused / sent back, cancelled → how risky", () => {
  const { summarizeHistory } = require(dist('services/phoneGuard.service.js'));
  const o = (orderStatus, extra = {}) => ({ orderStatus, orderNumber: 'x', createdAt: new Date(), ...extra });
  assert.equal(summarizeHistory([], false).risk, 'new');
  assert.equal(summarizeHistory([o('delivered'), o('delivered')], false).risk, 'good');
  const refused = summarizeHistory([o('delivered'), o('returned')], false);
  assert.equal(refused.refused, 1);
  assert.equal(refused.risk, 'high', 'sent back without delivery');
  assert.equal(summarizeHistory([o('returned', { deliveredAt: new Date() })], false).refused, 0, 'a return after delivery is not a refusal');
  assert.equal(summarizeHistory([o('cancelled', { deliveryIssue: { reason: 'refused' } })], false).risk, 'high', 'courier said refused');
  assert.equal(summarizeHistory([o('cancelled'), o('cancelled')], false).risk, 'watch');
  assert.equal(summarizeHistory([o('shipped', { deliveryAttempts: 3 })], false).risk, 'watch');
  assert.equal(summarizeHistory([o('delivered')], true).risk, 'blocked');
});

test('blocking: one row per number; unblock by id or by number; routes, rights, staff log', async () => {
  const { BlockedPhone } = require(dist('models/BlockedPhone.js'));
  const guard = require(dist('services/phoneGuard.service.js'));
  const orig = { findOne: BlockedPhone.findOne, create: BlockedPhone.create, deleteOne: BlockedPhone.deleteOne };
  let created;
  let deleted;
  BlockedPhone.findOne = async (q) => (q.key === '600000000' ? { _id: 'old' } : null);
  BlockedPhone.create = async (doc) => {
    created = doc;
    return { _id: 'new' };
  };
  BlockedPhone.deleteOne = async (q) => {
    deleted = q;
    return { deletedCount: 1 };
  };
  try {
    assert.deepEqual(await guard.blockPhone({ phone: '+212 6 00 00 00 00' }), { _id: 'old', already: true });
    const r = await guard.blockPhone({ phone: ' 06 11 22 33 44 ', reason: ' refused 2 parcels ' });
    assert.equal(r.already, false);
    assert.equal(created.key, '611223344');
    assert.equal(created.reason, 'refused 2 parcels');
    await assert.rejects(() => guard.blockPhone({ phone: '12' }), /full phone number/);
    await guard.unblockPhone('0611223344');
    assert.deepEqual(deleted, { key: '611223344' });
    await guard.unblockPhone('a'.repeat(24));
    assert.deepEqual(deleted, { _id: 'a'.repeat(24) });
  } finally {
    Object.assign(BlockedPhone, orig);
  }
  const routes = read('backend/src/routes/phoneGuard.routes.ts');
  assert.ok(routes.includes("'/admin/phone-history',\n  requireAuth,\n  requirePermission('orders:read'),") || routes.includes("'/admin/phone-history',\r\n  requireAuth,\r\n  requirePermission('orders:read'),"));
  assert.equal((routes.match(/requirePermission\('orders:write'\)/g) || []).length, 2, 'block / unblock need order rights');
  assert.ok(!/route === 'blocked-phones'|route === 'phone-history'/.test(read('api/v1/admin.js')), 'live site passes them to Express');
  const { describeStaffAction } = require(dist('utils/staffActions.js'));
  assert.equal(describeStaffAction('POST', 'admin/blocked-phones').action, 'Blocked a phone number');
  assert.equal(describeStaffAction('DELETE', 'admin/blocked-phones/x').action, 'Unblocked a phone number');
});

test('admin: history + Block on every order; the list in Settings → Customers & pricing', () => {
  const f = (p) => read(path.join('frontend/src', p));
  assert.ok(f('pages/admin/OrderDetail.tsx').includes('<PhoneRiskCard phone={o.shippingAddress?.phone || phone || undefined} orderId={o._id} />'));
  assert.ok(f('pages/admin/Settings.tsx').includes('<BlockedPhonesSettings />'));
  assert.ok(f('lib/adminSearch.ts').includes("label: 'Blocked phone numbers'"));
});
