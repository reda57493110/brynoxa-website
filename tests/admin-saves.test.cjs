// Live admin saves use the same checks as the forms (security fix #6): real form data is
// accepted, hidden fields are dropped, impossible values are refused.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { api, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

// api/v1/admin.js keeps validated() private; load it as written in the file
const src = fs.readFileSync(api('v1/admin.js'), 'utf8');
const fn = src.slice(src.indexOf('function validated('), src.indexOf('async function handleCategoryMutation'));
const validated = new Function('require', fn + '; return validated')((m) => require(path.join(api('v1'), m)));
const run = (name, body, partial) => {
  try {
    return { data: validated(name, body, partial) };
  } catch (e) {
    return { err: e.message, status: e.statusCode };
  }
};
const id = 'a'.repeat(24);

// Exactly what the product form sends (create)
const create = {
  name: 'HP EliteBook 840 G7', sku: 'HP-ELITEBOOK-840', description: '', category: id, brand: id, price: 3600, costPrice: null,
  deposit: null, stock: 3, condition: 'refurbished', conditionNote: 'Like new', serialTracking: false, inventoryLocation: '',
  tags: ['laptop'], isFeatured: false, isCarousel: true, isActive: true, recommended: [id], recommendedOnly: false,
  recommendedHidden: [], specs: { cpu: 'i7-10610U', ram_gb: '16' }, specTemplate: '',
  images: [
    { url: 'https://res.cloudinary.com/demo/image/upload/v1/p.jpg', publicId: 'p', alt: 'HP', isPrimary: true },
    { url: '/api/v1/images/' + 'b'.repeat(24), publicId: 'db_x', alt: 'HP', isPrimary: false },
  ],
};

test('the product form (create and edit) is accepted with every field kept', () => {
  const r = run('productSchema', create);
  assert.equal(r.err, undefined);
  for (const k of Object.keys(create)) assert.ok(k in r.data, k);
  const edit = { ...create, variantLabel: '16 GB · 512 GB' };
  delete edit.stock;
  const e = run('productSchema', edit, true);
  assert.equal(e.err, undefined);
  assert.equal('stock' in e.data, false);
});

test('one-click product changes touch nothing else', () => {
  for (const p of [{ isActive: false }, { isFeatured: true }, { isCarousel: false }, { category: id }]) assert.deepEqual(run('productSchema', p, true).data, p);
  assert.equal(run('productSchema', { images: [{ url: '/products/old.jpg' }] }, true).err, undefined, 'older site-path photo');
});

test('hidden fields are dropped and impossible values refused', () => {
  const r = run('productSchema', { isActive: true, soldCount: 9999, averageRating: 5, reviewCount: 800, inventory: { physical: 999 }, unitCosts: { other: 0 } }, true);
  assert.deepEqual(r.data, { isActive: true });
  assert.equal(run('productSchema', { images: [{ url: 'javascript:alert(1)' }] }, true).status, 400);
  assert.match(run('productSchema', { price: -5 }, true).err, /price/);
  assert.equal('usedCount' in run('couponSchema', { isActive: true, usedCount: -1000 }, true).data, false);
});

test('coupons, categories and brands from the admin forms are accepted', () => {
  assert.equal(run('couponSchema', { code: 'RAMADAN10', type: 'percent', value: 10, minOrder: 0, maxUses: 0, expiresAt: '2026-12-31' }).err, undefined);
  assert.deepEqual(run('couponSchema', { isActive: false }, true).data, { isActive: false });
  assert.equal(run('categorySchema', { name: 'Laptops' }).err, undefined);
  assert.equal(run('categorySchema', { specTemplate: 'laptop' }, true).err, undefined);
  assert.equal(run('brandSchema', { name: 'HP' }).err, undefined);
});

test('settings: plain values must be valid', () => {
  const { settingsScalarsSchema: S } = require(dist('validators/schemas'));
  assert.ok(S.safeParse({ storeName: 'Brynoxa' }).success);
  assert.equal(S.safeParse({ taxRate: -10 }).success, false);
  assert.equal(S.safeParse({ shippingFlatRate: -1 }).success, false);
  assert.ok(S.safeParse({ supportEmail: '' }).success);
  assert.equal(S.safeParse({ supportEmail: 'nope' }).success, false);
});
