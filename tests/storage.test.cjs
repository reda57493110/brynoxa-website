// Admin → Settings → Storage: database size against the plan's limit (512 MB free plan by
// default), what part is photos, when to suggest Cloudinary, and only staff with the Settings
// permission can read it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { storageSummary } = require(dist('services/storage.service.js'));
const { env } = require(dist('config/env.js'));
const MB = 1024 * 1024;
const base = { dataBytes: 0, indexBytes: 0, photoCount: 0, photoBytes: 0, limitMb: 512, cloudinary: false, counts: { products: 18, orders: 40, customers: 25 } };

test('the free plan limit is 512 MB unless STORAGE_LIMIT_MB says otherwise', () => {
  assert.equal(env.STORAGE_LIMIT_MB, 512);
});

test('data and indexes count against the limit; levels at 60 % and 85 %', () => {
  const small = storageSummary({ ...base, dataBytes: 4 * MB, indexBytes: 1 * MB });
  assert.equal(small.usedBytes, 5 * MB);
  assert.equal(small.limitBytes, 512 * MB);
  assert.equal(small.percent, 1);
  assert.equal(small.level, 'ok');
  assert.equal(storageSummary({ ...base, dataBytes: 310 * MB }).level, 'watch');
  assert.equal(storageSummary({ ...base, dataBytes: 440 * MB }).level, 'high');
  assert.equal(storageSummary({ ...base, dataBytes: 600 * MB }).percent, 117.2, 'over the limit is shown as it is');
  assert.deepEqual(storageSummary({ ...base, dataBytes: 3 * MB }).counts, base.counts);
});

test('Cloudinary is suggested only when photos are in the database and take room', () => {
  // the shop today: a few small photos, plenty of room
  const today = storageSummary({ ...base, dataBytes: 5 * MB, photoCount: 6, photoBytes: 0.2 * MB });
  assert.equal(today.photos.share, 4);
  assert.equal(today.suggestCloudinary, false);
  // photos are most of the database
  assert.equal(storageSummary({ ...base, dataBytes: 40 * MB, photoCount: 300, photoBytes: 30 * MB }).suggestCloudinary, true);
  // getting full with photos in it
  assert.equal(storageSummary({ ...base, dataBytes: 350 * MB, photoCount: 10, photoBytes: 5 * MB }).suggestCloudinary, true);
  // full but no photos to move: moving would not help
  assert.equal(storageSummary({ ...base, dataBytes: 450 * MB }).suggestCloudinary, false);
});

test('only staff with the Settings permission can read it', () => {
  const routes = fs.readFileSync(dist('routes/commerce.routes.js'), 'utf8');
  assert.match(routes, /\/admin\/storage['"],\s*auth_1\.requireAuth,\s*\(0, auth_1\.requirePermission\)\('settings'\)/);
});
