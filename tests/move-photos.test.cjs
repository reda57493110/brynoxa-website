// "Move photos to Cloudinary": photos stored in the database move to Cloudinary (products and
// categories); a failure keeps the old link; the old copy is deleted only when nothing uses it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { api, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Product } = require(dist('models/Product'));
const { Category } = require(dist('models/Category'));
const { StoredImage } = require(dist('models/StoredImage'));
const cloud = require(dist('config/cloudinary'));
const upload = require(dist('services/upload.service'));
const move = require(dist('services/photoMove.service'));

const A = 'aaaaaaaaaaaaaaaaaaaaaaa1';
const B = 'aaaaaaaaaaaaaaaaaaaaaaa2';
const BAD = 'aaaaaaaaaaaaaaaaaaaaaaa3';
let products;
let categories;
const updates = [];
const deleted = [];
const lean = (v) => ({ select: () => ({ lean: async () => v() }) });
Product.find = () => lean(() => products);
Category.find = () => lean(() => categories);
Product.updateOne = async (q, u) => updates.push(['product', q._id, u.$set]);
Category.updateOne = async (q, u) => updates.push(['category', q._id, u.$set]);
Product.exists = async () => null;
Category.exists = async () => null;
StoredImage.findById = async (id) => (id === BAD ? null : { data: Buffer.from('img'), contentType: 'image/jpeg' });
StoredImage.deleteOne = async (q) => deleted.push(q._id);
upload.uploadProductImage = async () => ({ url: 'https://res.cloudinary.com/x/image/upload/p.jpg', publicId: 'brynoxa/p' });

const reset = () => {
  products = [{ _id: 'p1', name: 'Laptop', images: [{ url: `/api/v1/images/${A}`, publicId: `db_${A}` }, { url: 'https://images.unsplash.com/x' }] }];
  categories = [{ _id: 'c1', name: 'Mice', image: `/api/v1/images/${B}` }];
  updates.length = 0;
  deleted.length = 0;
};

test('counting works without Cloudinary; moving asks for the keys first', async () => {
  reset();
  cloud.cloudinaryConfigured = false;
  const r = await move.moveStoredPhotos({ dryRun: true });
  assert.deepEqual([r.cloudinary, r.photos, r.remaining], [false, 2, 2]);
  await assert.rejects(move.moveStoredPhotos(), /Cloudinary keys/);
});

test('products and categories move; other photos untouched; old copies deleted', async () => {
  reset();
  cloud.cloudinaryConfigured = true;
  const r = await move.moveStoredPhotos();
  assert.equal(r.remaining, 0);
  const [, , set] = updates.find((u) => u[0] === 'product');
  assert.equal(set.images[0].url, 'https://res.cloudinary.com/x/image/upload/p.jpg');
  assert.equal(set.images[0].publicId, 'brynoxa/p');
  assert.equal(set.images[1].url, 'https://images.unsplash.com/x');
  assert.deepEqual(updates.find((u) => u[0] === 'category')[2], { image: 'https://res.cloudinary.com/x/image/upload/p.jpg' });
  assert.deepEqual(deleted.sort(), [A, B].sort());
});

test('a photo that cannot be moved keeps its link and is skipped next time', async () => {
  reset();
  cloud.cloudinaryConfigured = true;
  products = [{ _id: 'p2', name: 'Mouse', images: [{ url: `/api/v1/images/${BAD}` }] }];
  categories = [];
  const r = await move.moveStoredPhotos();
  assert.deepEqual(r.processed[0], { key: 'p2', name: 'Mouse', moved: 0, failed: 1 });
  assert.equal(updates.length, 0);
  assert.equal(deleted.length, 0);
  const again = await move.moveStoredPhotos({ skip: ['p2'] });
  assert.equal(again.remaining, 0);
  cloud.cloudinaryConfigured = false;
});

test('route: product editors only; the server function hands it to Express', () => {
  const routes = fs.readFileSync(dist('routes/catalog.routes.js'), 'utf8');
  assert.match(routes, /'\/admin\/products\/move-photos', auth_1\.requireAuth, \(0, auth_1\.requirePermission\)\('products:write'\)/);
  assert.match(fs.readFileSync(api('v1/admin.js'), 'utf8'), /route === 'products\/move-photos'/);
});
