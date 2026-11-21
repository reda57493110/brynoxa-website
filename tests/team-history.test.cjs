// Admin → Team history (owner only): everything the staff did, newest first — order steps and calls
// (with order number / status so the page can translate them), orders added, other changes — and
// the orders each one worked on, with who added / moved them and where they are now.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Types } = require(path.join(ROOT, 'backend/node_modules/mongoose'));
const { User } = require(dist('models/User'));
const { Order } = require(dist('models/Order'));
const { StaffAction } = require(dist('models/StaffAction'));

const A = new Types.ObjectId();
const B = new Types.ObjectId();
const now = Date.now();
const ago = (min) => new Date(now - min * 60000);
const lean = (v) => ({ select: () => ({ sort: () => ({ lean: async () => v }) }), sort: () => ({ limit: () => ({ lean: async () => v }) }) });

User.find = () => lean([
  { _id: A, name: 'Yassine', email: 'y@x.ma', role: 'orders', isActive: true },
  { _id: B, name: 'Imane', email: 'i@x.ma', role: 'catalog', isActive: true },
]);
let orderQuery;
Order.find = (q) => {
  orderQuery = q;
  return {
    select: () => ({
      sort: () => ({
        limit: () => ({
          lean: async () => [
            {
              _id: new Types.ObjectId(),
              orderNumber: 'BRX-1',
              orderStatus: 'delivered',
              createdAt: ago(600),
              updatedAt: ago(10),
              createdBy: A,
              pricing: { total: 1840 },
              shippingAddress: { fullName: 'Salma' },
              timeline: [
                { status: 'confirmed', at: ago(300), by: A },
                { status: 'delivered', at: ago(10), by: A, note: 'Paid' },
              ],
              contactAttempts: [{ channel: 'call', outcome: 'no_answer', at: ago(400), by: A }],
            },
          ],
        }),
      }),
    }),
  };
};
StaffAction.find = () => ({ sort: () => ({ limit: () => ({ lean: async () => [
  { user: B, kind: 'product', action: 'Edited a product', targetId: 'p1', at: ago(20) },
  { user: A, kind: 'order-status', action: 'ignored (comes from the order)', at: ago(10) },
] }) }) });

const activity = require(dist('services/staffActivity.service'));

test('everything, newest first, with who did it; order lines carry number and status', async () => {
  const h = await activity.teamHistory(7);
  assert.deepEqual(h.feed.map((f) => f.kind), ['order-status', 'product', 'order-status', 'order-contact']);
  const last = h.feed[0];
  assert.equal(last.byName, 'Yassine');
  assert.equal(last.orderNumber, 'BRX-1');
  assert.equal(last.status, 'delivered');
  assert.equal(h.feed[1].byName, 'Imane');
  assert.equal(h.feed[1].link, '/admin/products/p1/edit');
  const call = h.feed.find((f) => f.kind === 'order-contact');
  assert.equal(call.channel, 'call');
  assert.equal(call.outcome, 'no_answer');
  assert.ok(!h.feed.some((f) => f.action.startsWith('ignored')), 'order steps are not listed twice');
});

test('their orders: added by, who worked on it, the last step, where it is now', async () => {
  const h = await activity.teamHistory(7);
  const o = h.orders[0];
  assert.equal(o.outcome, 'done');
  assert.equal(o.addedBy.name, 'Yassine');
  assert.deepEqual(o.staff, [{ _id: String(A), name: 'Yassine', steps: 3 }]);
  assert.equal(o.last.status, 'delivered');
  assert.ok(JSON.stringify(orderQuery).includes('createdBy'), 'orders added by staff are included');
});

test('one person only; unknown person refused', async () => {
  await activity.teamHistory(30, String(B));
  await assert.rejects(activity.teamHistory(30, String(new Types.ObjectId())), /not found/);
  await assert.rejects(activity.teamHistory(30, 'nope'), /not found/);
});

test('owner only, on both paths; menu entry; page in three languages', () => {
  const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  assert.match(read('backend/src/routes/commerce.routes.ts'), /router\.get\('\/admin\/team-history', requireAuth, requirePermission\('users:manage'\), misc\.teamHistory\)/);
  assert.match(read('api/v1/admin.js'), /route === 'team-history'[\s\S]{0,120}requireStaff\(req, res, \['users:manage'\]\)/);
  assert.match(read('frontend/src/lib/permissions.ts'), /'\/admin\/history': 'users:manage'/);
  assert.match(read('frontend/src/components/layout/AdminSidebar.tsx'), /to: '\/admin\/history', label: 'nav\.history'/);
  assert.match(read('frontend/src/app/router.tsx'), /path="history" element=\{<S><AdminTeamHistory \/><\/S>\}/);
  // Every text in English, French and Darija
  const texts = read('frontend/src/i18n/adminText/history.ts');
  const keys = [...texts.matchAll(/^  '(hist\.[^']+)':/gm)].map((m) => m[1]);
  const unique = new Set(keys);
  assert.equal(keys.length, unique.size * 3, 'every key in en, fr and ar');
});
