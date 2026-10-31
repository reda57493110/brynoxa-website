// Guest checkout with the phone only: a guest gives name, phone, address and city — no email.
// - the same phone (written any way) finds the same guest, so their orders stay together;
// - only other guests are matched, never a real account with that phone;
// - an email is only asked to create an account;
// - admin: guests are marked and can be listed; no reset link / email for a guest without email.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { User } = require(dist('models/User'));
const db = [];
const match = (u, q) =>
  Object.entries(q).every(([k, v]) => {
    const val = u.get(k);
    if (v instanceof RegExp) return v.test(String(val ?? ''));
    return String(val) === String(v);
  });
const chain = (r) => ({ select: () => chain(r), sort: () => chain(r), then: (a, b) => Promise.resolve(r).then(a, b) });
User.findOne = (q) => chain(db.find((u) => match(u, q)) || null);
User.findById = (id) => chain(db.find((u) => String(u._id) === String(id)) || null);
User.create = async (o) => {
  const u = new User(o);
  db.push(u);
  return u;
};
User.prototype.save = async function () {
  return this;
};

const auth = require(dist('services/auth.service'));
const address = (phone) => ({ fullName: 'Ahmed Benali', line1: '12 Rue Atlas', city: 'Casablanca', phone });
const order = (phone, extra = {}) =>
  auth.resolveCheckoutCustomer({ name: 'Ahmed Benali', phone, shippingAddress: address(phone), ...extra });

test('a guest orders with name, phone, address and city — no email', async () => {
  const { userId, auth: session } = await order('06 12 34 56 78');
  assert.equal(session, null, 'stays a guest (not signed in)');
  const guest = db.find((u) => String(u._id) === userId);
  assert.equal(guest.isGuest, true);
  assert.match(guest.email, /@no-email\.invalid$/, 'a stand-in address that is never emailed');
  assert.equal(guest.addresses[0].city, 'Casablanca');
});

test('the same phone written differently is the same guest; their orders stay together', async () => {
  const first = await order('0612345678');
  for (const phone of ['+212 6 12 34 56 78', '00212612345678', '06-12-34-56-78']) {
    assert.equal((await order(phone)).userId, first.userId, phone);
  }
  assert.notEqual((await order('0699999999')).userId, first.userId);
});

test('never put a guest order into a real account that has the same phone', async () => {
  const real = await User.create({ name: 'Real', email: 'real@x.com', password: 'Password123', phone: '0655555555', isGuest: false });
  const { userId } = await order('06 55 55 55 55');
  assert.notEqual(userId, String(real._id));
});

test('refused: a phone too short; a password without an email', async () => {
  await assert.rejects(order('0612'), /valid phone number/);
  await assert.rejects(order('0612345678', { password: 'Password123' }), /email to create an account/);
});

test('the order form accepts no email (or an empty one)', () => {
  const { createOrderSchema } = require(dist('validators/schemas'));
  const base = { items: [{ productId: 'p1', qty: 1 }], shippingAddress: address('0612345678') };
  assert.ok(createOrderSchema.safeParse(base).success);
  assert.ok(createOrderSchema.safeParse({ ...base, email: '' }).success);
  assert.equal(createOrderSchema.safeParse({ ...base, email: 'nope' }).success, false);
});

test('no password reset link for a guest without email (nothing to sign in with)', async () => {
  const guest = await User.create({ name: 'G', email: 'phone-612345678-ab12cd34@no-email.invalid', password: 'x'.repeat(48), phone: '0612345678', isGuest: true, role: 'customer', isActive: true });
  User.findById = () => chain(guest);
  await assert.rejects(auth.createPasswordLinkForCustomer(String(guest._id)), /no email/);
});

test('checkout page: guest by default, email only for an account; payment said once', () => {
  const page = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/store/Checkout.tsx'), 'utf8');
  assert.match(page, /useState<'guest' \| 'account'>\('guest'\)/);
  assert.match(page, /email: !isAuth && createAccount \? email\.trim\(\) : undefined/);
  assert.doesNotMatch(page, /title=\{t\('checkout\.paymentTitle'\)\}/, 'no separate Payment section');
  assert.doesNotMatch(page, /payOnArrival/, 'no repeated "Pay on arrival" badge');
  assert.doesNotMatch(page, /Phones: the products, folded under a one-line summary/, 'no second summary card on phones');
  assert.equal((page.match(/\{paymentNote\}/g) || []).length, 2, 'once on phones, once on computers');
});

test('admin: guests are marked and can be listed on their own', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  assert.match(src('backend/src/services/customerAnalytics.service.ts'), /if \(query\.status === 'guest'\) and\.push\(\{ isGuest: true \}\)/);
  assert.match(src('backend/src/controllers/customer.controller.ts'), /'wholesale-pending', 'guest', 'account'/);
  assert.match(src('frontend/src/components/admin/customers/CustomerFilters.tsx'), /<option value="guest">/);
  assert.equal((src('frontend/src/components/admin/customers/CustomerTable.tsx').match(/c\.isGuest \? <GuestBadge \/>/g) || []).length, 2, 'phones and computers');
});
