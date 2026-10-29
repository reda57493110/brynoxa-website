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

test('only staff with the Settings permission can read it or change the plan size', () => {
  const routes = fs.readFileSync(dist('routes/commerce.routes.js'), 'utf8');
  assert.match(routes, /router\.get\('\/admin\/storage',\s*auth_1\.requireAuth,\s*\(0, auth_1\.requirePermission\)\('settings'\)/);
  assert.match(routes, /router\.patch\('\/admin\/storage',\s*auth_1\.requireAuth,\s*\(0, auth_1\.requirePermission\)\('settings'\),\s*\(0, validate_1\.validate\)\(schemas_1\.storageLimitSchema\)/);
  const { describeStaffAction } = require(dist('utils/staffActions.js'));
  assert.equal(describeStaffAction('PATCH', 'admin/storage')?.action, 'Changed the database plan size');
});

test('the plan size chosen in the box wins, then the server setting, then the free plan', () => {
  const { planLimitMb } = require(dist('services/storage.service.js'));
  assert.deepEqual(planLimitMb(10240, 512), { limitMb: 10240, limitSource: 'set' });
  assert.deepEqual(planLimitMb(0, 2048), { limitMb: 2048, limitSource: 'server' });
  assert.deepEqual(planLimitMb(0, 512), { limitMb: 512, limitSource: 'default' });
  assert.deepEqual(planLimitMb(undefined, undefined), { limitMb: 512, limitSource: 'default' });
});

test('plan sizes outside 100 MB – 4 TB are refused (0 goes back to the default)', () => {
  const { storageLimitSchema } = require(dist('validators/schemas.js'));
  for (const ok of [0, 512, 5120, 40960]) assert.equal(storageLimitSchema.safeParse({ limitMb: ok }).success, true, String(ok));
  for (const bad of [-1, 50, 1.5, 5_000_000, '512']) assert.equal(storageLimitSchema.safeParse({ limitMb: bad }).success, false, String(bad));
});

test('Cloudinary usage: its plan, storage and monthly credits, read from its report', () => {
  const { cloudinaryUsageSummary } = require(dist('services/storage.service.js'));
  const free = cloudinaryUsageSummary({
    plan: 'Free',
    storage: { usage: 120 * MB },
    bandwidth: { usage: 3 * 1024 * MB },
    credits: { usage: 3.2, limit: 25, used_percent: 12.8 },
  });
  assert.deepEqual(free, { plan: 'Free', storageBytes: 120 * MB, bandwidthBytes: 3 * 1024 * MB, creditsUsed: 3.2, creditsLimit: 25, creditsPercent: 12.8, level: 'ok' });
  assert.equal(cloudinaryUsageSummary({ plan: 'Plus', credits: { usage: 200, limit: 225 } }).creditsPercent, 88.9, 'percent worked out when missing');
  assert.equal(cloudinaryUsageSummary({ plan: 'Plus', credits: { usage: 200, limit: 225 } }).level, 'high');
  assert.equal(cloudinaryUsageSummary(null), null);
  assert.equal(cloudinaryUsageSummary({}).plan, null, 'missing fields stay empty, nothing breaks');
});
