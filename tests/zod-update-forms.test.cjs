// zod 4: a field with a default inside an all-optional "edit" form would get that default even when
// it was not sent (saving only a price would wipe the description, editing an address would rename
// it "Home"). Edit forms use forUpdate(), which never fills in defaults.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const schemas = require(dist('validators/schemas.js'));

test('edit forms leave fields that were not sent alone', () => {
  assert.deepEqual(schemas.forUpdate(schemas.productSchema).parse({ price: 4200 }), { price: 4200 });
  assert.deepEqual(schemas.forUpdate(schemas.addressSchema).parse({ city: 'Rabat' }), { city: 'Rabat' });
  // Still checked: a bad value is refused
  assert.equal(schemas.forUpdate(schemas.productSchema).safeParse({ name: 'x' }).success, false);
  // New items still get their defaults
  assert.equal(schemas.addressSchema.parse({ fullName: 'Youssef A', line1: '12 Rue Ibn Sina', city: 'Rabat', phone: '0612345678' }).label, 'Home');
});

test('every edit route uses forUpdate, never .partial()', () => {
  for (const f of ['routes/auth.routes.js', 'routes/catalog.routes.js', 'routes/commerce.routes.js']) {
    assert.doesNotMatch(fs.readFileSync(dist(f), 'utf8'), /Schema\.partial\(\)/, f);
  }
  for (const f of ['v1/admin.js', '_lib/auth-routes/me.js']) {
    assert.match(fs.readFileSync(api(f), 'utf8'), /partial \? schemas\.forUpdate\(schemas\[schemaName\]\)/, f);
  }
  assert.match(JSON.parse(fs.readFileSync(path.join(ROOT, 'backend/package.json'), 'utf8')).dependencies.zod, /^\^4\./);
});
