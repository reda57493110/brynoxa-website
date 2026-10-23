// Deleting a category deletes its products too (needs the "delete products" permission); the photo
// address picked in admin is checked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { api, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Category } = require(dist('models/Category'));
const { Product } = require(dist('models/Product'));
const catalog = require(dist('services/catalog.service'));
const { categorySchema } = require(dist('validators/schemas'));

const A = '64b000000000000000000001';
const B = '64b000000000000000000002';
const calls = [];
let products = [];
Category.findById = async (id) => (id === A ? { _id: A, parent: null } : null);
Category.updateMany = async () => calls.push('parents');
Category.deleteOne = async (q) => calls.push(`delete category ${q._id}`);
Product.find = () => ({ lean: async () => products.map((_id) => ({ _id })) });
// The product delete itself (photos, variants): only the find-and-delete step is faked
Product.findByIdAndDelete = async (id) => {
  calls.push(`delete product ${id}`);
  return { images: [], variantGroup: null };
};

test('an empty category is deleted', async () => {
  calls.length = 0;
  products = [];
  await catalog.deleteCategory(A);
  assert.deepEqual(calls, ['parents', `delete category ${A}`]);
});

test('its products are deleted with it', async () => {
  calls.length = 0;
  products = ['p1', 'p2', 'p3'];
  await catalog.deleteCategory(A, { canDeleteProducts: true });
  assert.deepEqual(calls.slice(0, 3), ['delete product p1', 'delete product p2', 'delete product p3']);
  assert.equal(calls.at(-1), `delete category ${A}`);
});

test('without the "delete products" permission, a category with products is kept', async () => {
  calls.length = 0;
  products = ['p1'];
  await assert.rejects(catalog.deleteCategory(A), /delete products/);
  assert.equal(calls.length, 0);
});

test('unknown category: 404', async () => {
  await assert.rejects(catalog.deleteCategory(B), /not found/);
});

test('both delete paths pass the staff member\'s permission', () => {
  assert.match(fs.readFileSync(api('v1/admin.js'), 'utf8'), /deleteCategory\(id, \{ canDeleteProducts: hasPermission\(user\.role, 'products:delete'\) \}\)/);
  assert.match(fs.readFileSync(dist('controllers/catalog.controller.js'), 'utf8'), /canDeleteProducts: \(0, permissions_1\.hasPermission\)\(req\.user\?\.role, 'products:delete'\)/);
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
