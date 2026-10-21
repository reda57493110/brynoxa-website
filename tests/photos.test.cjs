// Photos pasted from other websites are copied into our own storage, safely (no server-side
// request forgery). No real network here: downloads and uploads are faked.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const remote = require(dist('utils/remoteImage'));
const upload = require(dist('services/upload.service'));
const { Product } = require(dist('models/Product'));
const { isOutsidePhoto, copyOutsidePhotos, copyCatalogOutsidePhotos } = require(dist('services/imageImport.service'));

test('which photos count as "from another website"', () => {
  assert.ok(isOutsidePhoto('https://jpm.ma/cdn/shop/files/x.webp?width=800'));
  assert.ok(isOutsidePhoto('http://myordi.ma/a.jpg'));
  assert.equal(isOutsidePhoto('/api/v1/images/' + 'a'.repeat(24)), false, 'our own storage');
  assert.equal(isOutsidePhoto('https://res.cloudinary.com/demo/image/upload/v1/p.jpg'), false, 'Cloudinary');
  assert.equal(isOutsidePhoto('https://images.unsplash.com/photo-1?w=1200'), false, 'Unsplash CDN');
  assert.equal(isOutsidePhoto('https://brynoxa-website-lime.vercel.app/api/v1/images/' + 'b'.repeat(24)), false);
  assert.equal(isOutsidePhoto(undefined), false);
});

test('dangerous addresses are refused before anything is downloaded', async () => {
  for (const bad of [
    'http://localhost/admin',
    'http://127.0.0.1:5000/',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/x.jpg',
    'http://192.168.1.1/x.jpg',
    'http://[::1]/',
    'http://0x7f000001/',
    'file:///etc/passwd',
    'ftp://example.com/a.jpg',
    'https://user:pw@example.com/a.jpg',
    'https://example.com:8443/a.jpg',
  ]) {
    await assert.rejects(remote.fetchRemoteImage(bad), (e) => e.statusCode === 400, bad);
  }
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '0.0.0.0']) assert.ok(remote.isPrivateAddress(ip), ip);
  for (const ip of ['8.8.8.8', '104.16.1.1', '2606:4700::1111']) assert.equal(remote.isPrivateAddress(ip), false, ip);
});

test('only real JPEG / PNG / WebP files are accepted', () => {
  assert.equal(remote.imageTypeOf(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(remote.imageTypeOf(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'image/png');
  assert.equal(remote.imageTypeOf(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')])), 'image/webp');
  assert.equal(remote.imageTypeOf(Buffer.from('<html>not a photo</html>')), null);
  assert.equal(remote.imageTypeOf(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
});

test('saving a product: outside photos copied, others untouched, a failed one keeps its link', async () => {
  const downloads = [];
  remote.fetchRemoteImage = async (url) => {
    downloads.push(url);
    if (url.includes('broken')) throw Object.assign(new Error('The other website answered 404'), { statusCode: 400 });
    return { buffer: Buffer.from([0xff, 0xd8, 0xff]), mimetype: 'image/jpeg' };
  };
  let n = 0;
  upload.uploadProductImage = async () => ({ url: `/api/v1/images/${String(++n).padStart(24, '0')}`, publicId: `db_${n}` });
  const r = await copyOutsidePhotos([
    { url: 'https://jpm.ma/a.webp', alt: 'HP', isPrimary: true },
    { url: 'https://jpm.ma/a.webp', alt: 'HP again' },
    { url: 'https://res.cloudinary.com/demo/image/upload/p.jpg', publicId: 'p' },
    { url: 'https://images.unsplash.com/photo-1?w=1200' },
    { url: 'https://shop.example/broken.jpg' },
  ]);
  assert.equal(r.copied, 1, 'the same photo twice is downloaded once');
  assert.deepEqual(downloads, ['https://jpm.ma/a.webp', 'https://shop.example/broken.jpg']);
  assert.equal(r.images[0].url, '/api/v1/images/' + '1'.padStart(24, '0'));
  assert.equal(r.images[0].isPrimary, true);
  assert.equal(r.images[0].alt, 'HP');
  assert.equal(r.images[1].url, r.images[0].url);
  assert.equal(r.images[2].url, 'https://res.cloudinary.com/demo/image/upload/p.jpg');
  assert.equal(r.images[3].url, 'https://images.unsplash.com/photo-1?w=1200');
  assert.equal(r.images[4].url, 'https://shop.example/broken.jpg', 'failed photo keeps its link');
  assert.equal(r.failed.length, 1);
});

test('existing catalogue: the button copies a few products per call and always finishes', async () => {
  const products = [
    { _id: 'p1', name: 'HP 830', images: [{ url: 'https://jpm.ma/a.webp' }] },
    { _id: 'p2', name: 'HP 440', images: [{ url: 'https://shop.example/broken.jpg' }] },
    { _id: 'p3', name: 'Cloudinary only', images: [{ url: 'https://res.cloudinary.com/x/image/upload/p.jpg' }] },
  ];
  Product.find = () => ({ select: () => ({ lean: async () => products.filter((p) => p.images.some((i) => /^https?:\/\//.test(i.url))) }) });
  Product.updateOne = async ({ _id }, { $set }) => {
    products.find((p) => p._id === _id).images = $set.images;
  };
  const count = await copyCatalogOutsidePhotos({ dryRun: true });
  assert.equal(count.remaining, 2);
  assert.equal(count.photos, 2);

  const skip = [];
  let rounds = 0;
  for (;;) {
    rounds++;
    const r = await copyCatalogOutsidePhotos({ skip });
    for (const p of r.processed) if (p.failed) skip.push(p.productId);
    if (!r.remaining || !r.processed.length || rounds > 5) break;
  }
  assert.ok(rounds <= 3, 'finishes quickly even with a broken photo');
  assert.match(products[0].images[0].url, /^\/api\/v1\/images\//, 'copied');
  assert.equal(products[1].images[0].url, 'https://shop.example/broken.jpg', 'kept as link');
  assert.equal((await copyCatalogOutsidePhotos({ dryRun: true, skip })).remaining, 0);
});
