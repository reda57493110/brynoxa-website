// Deleting a category that still has products moves them to another category first; the photo
// address picked in admin is checked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Category } = require(dist('models/Category'));
const { Product } = require(dist('models/Product'));
const catalog = require(dist('services/catalog.service'));
const { categorySchema } = require(dist('validators/schemas'));

const A = '64b000000000000000000001';
const B = '64b000000000000000000002';
const calls = [];
let productsInA = 0;
Category.findById = async (id) => (id === A ? { _id: A, parent: null } : null);
Category.exists = async (q) => (String(q._id) === B ? { _id: B } : null);
Category.updateMany = async (...a) => calls.push(['parents', ...a]);
Category.deleteOne = async (q) => calls.push(['delete', q._id]);
Product.countDocuments = async () => productsInA;
Product.updateMany = async (filter, update) => {
  calls.push(['move', filter.category, update.$set.category]);
  productsInA = 0;
};

test('an empty category is deleted', async () => {
  calls.length = 0;
  productsInA = 0;
  await catalog.deleteCategory(A);
  assert.deepEqual(calls.map((c) => c[0]), ['parents', 'delete']);
});

test('with products: asks where to move them, then moves and deletes', async () => {
  calls.length = 0;
  productsInA = 3;
  await assert.rejects(catalog.deleteCategory(A), /still has 3 products/);
  await assert.rejects(catalog.deleteCategory(A, A), /another existing category/);
  await assert.rejects(catalog.deleteCategory(A, '64b000000000000000000009'), /another existing category/);
  await assert.rejects(catalog.deleteCategory(A, 'not-an-id'), /another existing category/);
  assert.equal(calls.length, 0, 'nothing changed on a refusal');
  await catalog.deleteCategory(A, B);
  assert.deepEqual(calls[0], ['move', A, B]);
  assert.equal(calls.at(-1)[0], 'delete');
});

test('unknown category: 404', async () => {
  await assert.rejects(catalog.deleteCategory(B), /not found/);
});

test('category photo: https or a site address, or empty for the built-in photo', () => {
  const ok = (image) => categorySchema.partial().safeParse({ image }).success;
  assert.ok(ok('https://res.cloudinary.com/x/image/upload/a.jpg'));
  assert.ok(ok('/api/v1/images/abc'));
  assert.ok(ok(''));
  assert.ok(!ok('http://example.com/a.jpg'));
  assert.ok(!ok('//evil.example/a.jpg'));
  assert.ok(!ok('javascript:alert(1)'));
});
