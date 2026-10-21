// Shared by guest-claim-*.test.cjs: nobody gets a guest customer's account without proving they
// own the email (security fix #2). `emailOn` = Resend configured or not.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { createHash } = require('crypto');
const { ROOT, dist, setTestEnv } = require('./_helpers.cjs');

module.exports = function guestClaimTests(emailOn) {
  setTestEnv(emailOn ? { RESEND_API_KEY: 're_test_key', EMAIL_FROM: 'Shop <a@shop.test>' } : {});

  const emailSvc = require(dist('services/email.service'));
  const sent = [];
  emailSvc.sendEmail = async (m) => {
    sent.push(m);
    return true;
  };
  // Store settings (email on/off switches) without a database
  require(dist('models/Settings')).Settings.findOne = async () => ({ emailNotifications: {}, emailMessages: {} });
  const { User } = require(dist('models/User'));
  const bcrypt = require(path.join(ROOT, 'backend/node_modules/bcryptjs'));

  // In-memory users
  const db = [];
  const mk = (o) => {
    const u = new User(o);
    db.push(u);
    return u;
  };
  const match = (u, q) =>
    Object.entries(q).every(([k, v]) => {
      const val = u.get(k);
      if (v && typeof v === 'object' && '$gt' in v) return val && val > v.$gt;
      return String(val) === String(v);
    });
  const chain = (r) => ({ select: () => chain(r), then: (a, b) => Promise.resolve(r).then(a, b) });
  User.findOne = (q) => chain(db.find((u) => match(u, q)) || null);
  User.findById = (id) => chain(db.find((u) => String(u._id) === String(id)) || null);
  User.create = async (o) => mk(o);
  User.updateOne = async () => ({ modifiedCount: 1 });
  User.prototype.save = async function () {
    // Like the real model: hash a new plain password once
    if (this.isModified('password') && !String(this.password).startsWith('$2')) this.password = await bcrypt.hash(this.password, 4);
    return this;
  };

  const auth = require(dist('services/auth.service'));

  let guest;
  let oldHash;
  test('setup', async () => {
    guest = mk({ name: 'Real Guest', email: 'guest@x.com', password: 'random-guest-pass-123', phone: '0611111111', isGuest: true });
    await guest.save();
    oldHash = guest.password;
    mk({ name: 'Real Customer', email: 'real@x.com', password: 'Password123', isGuest: false });
  });

  test('a brand-new email signs up and is logged in directly', async () => {
    const r = await auth.registerUser({ name: 'New', email: 'new@x.com', password: 'Password123' });
    assert.ok(r.accessToken && r.user);
  });

  test("signing up with a guest's email does not hand over the account", async () => {
    let result;
    let error;
    try {
      result = await auth.registerUser({ name: 'Attacker', email: 'guest@x.com', password: 'Attacker123' });
    } catch (e) {
      error = e;
    }
    if (emailOn) {
      assert.equal(result.verificationRequired, true);
      assert.equal(result.accessToken, undefined);
      assert.ok(sent.some((m) => m.to === 'guest@x.com' && /Finish creating/.test(m.subject)));
    } else {
      assert.equal(error?.statusCode, 409);
      assert.match(error.message, /contact us/i);
    }
    assert.equal(guest.password, oldHash);
    assert.equal(guest.isGuest, true);
    assert.equal(guest.name, 'Real Guest');
    assert.equal(guest.phone, '0611111111');
  });

  test('an existing real account is still "already registered"', async () => {
    await assert.rejects(auth.registerUser({ name: 'X', email: 'real@x.com', password: 'Password123' }), (e) => e.statusCode === 409);
  });

  test("checkout with 'create account' + a guest's email: order as guest, nothing changed", async () => {
    const r = await auth.resolveCheckoutCustomer({ email: 'guest@x.com', name: 'Attacker', phone: '0699999999', password: 'Attacker123' });
    assert.equal(r.userId, String(guest._id));
    assert.equal(r.auth, null);
    assert.equal(guest.password, oldHash);
    assert.equal(guest.name, 'Real Guest');
    assert.equal(guest.phone, '0611111111');
  });

  test('a new guest checkout does not overwrite the saved name or phone', async () => {
    const r = await auth.resolveCheckoutCustomer({ email: 'guest@x.com', name: 'Someone', phone: '0688888888' });
    assert.equal(r.auth, null);
    assert.equal(guest.name, 'Real Guest');
    assert.equal(guest.phone, '0611111111');
  });

  test('checkout creating a brand-new account logs in', async () => {
    const r = await auth.resolveCheckoutCustomer({ email: 'fresh@x.com', name: 'Fresh', password: 'Password123' });
    assert.ok(r.auth?.accessToken);
  });

  if (emailOn) {
    test('forgot password for a guest: the emailed link opens the account', async () => {
      sent.length = 0;
      await auth.requestPasswordReset('guest@x.com');
      const mail = sent.find((m) => m.to === 'guest@x.com');
      assert.match(mail.subject, /Finish creating/);
      const token = /token=([a-f0-9]{64})/.exec(mail.html)[1];
      assert.equal(guest.passwordResetTokenHash, createHash('sha256').update(token).digest('hex'));
      await auth.resetPassword(token, 'MyNewPass123');
      assert.equal(guest.isGuest, false);
      assert.equal(guest.emailVerified, true);
      const login = await auth.loginUser('guest@x.com', 'MyNewPass123');
      assert.ok(login.accessToken);
    });
  }
};
