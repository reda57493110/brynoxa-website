// Customer profile / address saves on the live API, and the user details returned at sign-in.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { api, dist, setTestEnv, fakeModule, callHandler } = require('./_helpers.cjs');
setTestEnv();

const s = require(dist('validators/schemas'));
const addr = { label: 'Home', fullName: 'يوسف العمراني', line1: '12 Rue Ibn Battouta, Hay Riad', line2: '', city: 'Casablanca', state: '', postalCode: '', country: 'MA', phone: '06 12 34 56 78', isDefault: true };

test('a real Moroccan address is accepted, also at checkout', () => {
  assert.ok(s.addressSchema.safeParse(addr).success);
  assert.ok(s.createOrderSchema.safeParse({ items: [{ productId: 'a'.repeat(24), qty: 1 }], shippingAddress: addr, email: 'a@x.com' }).success);
});

test('huge values and unknown keys are refused or dropped; role cannot be set', () => {
  assert.equal(s.addressSchema.safeParse({ ...addr, line1: 'x'.repeat(100000) }).success, false);
  const r = s.addressSchema.safeParse({ ...addr, $set: { role: 'admin' }, foo: 1 });
  assert.ok(r.success && !('$set' in r.data) && !('foo' in r.data));
  assert.equal('role' in s.updateProfileSchema.parse({ name: 'Youssef', role: 'admin' }), false);
  assert.equal(s.updateProfileSchema.safeParse({ phone: '1'.repeat(5000) }).success, false);
});

test('live profile and address saves use those checks', async () => {
  const user = { _id: 'u1', name: 'Old', phone: '', addresses: Object.assign([], { id: () => null }), role: 'customer', isActive: true, async save() {} };
  fakeModule(api('_lib/auth.js'), { requireUser: async () => user });
  const me = require(api('_lib/auth-routes/me.js'));
  const quiet = console.error;
  console.error = () => {};
  try {
    let r = await callHandler(me, { method: 'PATCH', url: '/api/v1/auth/me', body: { name: '  Youssef  ', phone: '0612345678', role: 'admin' } });
    assert.equal(r.status, 200);
    assert.equal(user.name, 'Youssef');
    assert.equal(user.role, 'customer');
    r = await callHandler(me, { method: 'PATCH', url: '/api/v1/auth/me', body: { name: 'x'.repeat(500) } });
    assert.equal(r.status, 400);
    assert.match(r.body.message, /name/);
    r = await callHandler(me, { method: 'POST', url: '/api/v1/auth/me?__route=addresses', body: addr });
    assert.equal(r.status, 201);
    assert.equal(user.addresses.length, 1);
    r = await callHandler(me, { method: 'POST', url: '/api/v1/auth/me?__route=addresses', body: { ...addr, city: 'x'.repeat(5000) } });
    assert.equal(r.status, 400);
    assert.equal(user.addresses.length, 1);
  } finally {
    console.error = quiet;
  }
});

test('sign-in and auto sign-in return wholesale status, never the password or tokens', () => {
  const { sanitizeUser } = require(dist('services/auth.service'));
  const u = sanitizeUser({ _id: 'u2', name: 'Shop', email: 's@x.com', role: 'customer', customerType: 'wholesale', wholesale: { status: 'approved' }, password: 'hash', refreshToken: 'h', addresses: [] });
  assert.equal(u.customerType, 'wholesale');
  assert.equal(u.wholesaleStatus, 'approved');
  assert.equal('password' in u, false);
  assert.equal('refreshToken' in u, false);
  for (const f of ['login.js', 'refresh.js']) {
    const src = fs.readFileSync(api('_lib/auth-routes/' + f), 'utf8');
    assert.match(src, /auth\.service'\)\.sanitizeUser\(user\)/, f + ' uses the shared user details');
  }
  assert.match(fs.readFileSync(api('_lib/auth-routes/refresh.js'), 'utf8'), /JWT_REFRESH_SECRET, \{ algorithms: \['HS256'\] \}/);
});
