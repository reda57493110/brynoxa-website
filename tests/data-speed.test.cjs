// Data speed (part C): busy pages read settings from a short cache, lists load only the fields
// they show, and the indexes for staff activity / lookups exist.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { api, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const SettingsModel = require(dist('models/Settings'));
const { Order } = require(dist('models/Order'));
const { Product } = require(dist('models/Product'));
const { User } = require(dist('models/User'));

test('settings: one read per 15 s for read-only pages; saving clears it', async () => {
  let reads = 0;
  const realFindOne = SettingsModel.Settings.findOne;
  SettingsModel.Settings.findOne = async () => ({ n: ++reads });
  try {
    SettingsModel.clearSettingsCache();
    const a = await SettingsModel.getSettingsCached();
    const b = await SettingsModel.getSettingsCached();
    assert.equal(reads, 1);
    assert.equal(a, b);
    SettingsModel.clearSettingsCache();
    await SettingsModel.getSettingsCached();
    assert.equal(reads, 2);
  } finally {
    SettingsModel.Settings.findOne = realFindOne;
    SettingsModel.clearSettingsCache();
  }
  // The save hook clears the cache
  const hooks = SettingsModel.Settings.schema.s.hooks._posts.get('save') || [];
  assert.ok(hooks.length > 0);
});

test('the leave-out field lists are accepted together with the hidden cost field', () => {
  const q = Order.find({}).select('+items.unitCost -timeline -contactAttempts -shippingAddress');
  q._applyPaths();
  assert.equal(q._fields.timeline, 0);
  assert.equal(q._fields['items.unitCost'], undefined, 'cost not hidden');
  const svc = fs.readFileSync(dist('services/customerAnalytics.service.js'), 'utf8');
  assert.equal((svc.match(/\.select\(ORDER_FIELDS_LIGHT\)/g) || []).length, 2, 'list and summary');
  assert.match(svc, /\.select\(ORDER_FIELDS\)\.populate\('timeline\.by'/, 'the customer page keeps the history');
  assert.match(fs.readFileSync(dist('services/profit.service.js'), 'utf8'), /-timeline -contactAttempts/);
  assert.match(fs.readFileSync(dist('services/order.service.js'), 'utf8'), /\.select\('-timeline -contactAttempts'\)/);
  assert.match(fs.readFileSync(dist('services/catalog.service.js'), 'utf8'), /select\(query\.admin \? '' : '-description'\)/);
});

test('indexes for staff activity and lookups are declared', () => {
  const keys = (m) => m.schema.indexes().map(([k]) => JSON.stringify(k));
  assert.ok(keys(Order).includes(JSON.stringify({ 'timeline.by': 1, 'timeline.at': -1 })));
  assert.ok(keys(Order).includes(JSON.stringify({ 'contactAttempts.by': 1, 'contactAttempts.at': -1 })));
  assert.ok(keys(Order).includes(JSON.stringify({ createdBy: 1, createdAt: -1 })));
  assert.ok(keys(Product).includes(JSON.stringify({ baseProduct: 1 })));
  assert.ok(keys(User).includes(JSON.stringify({ role: 1, createdAt: -1 })));
});

test('connection: index sync only when the indexes changed; a failed connect is retried', () => {
  const db = fs.readFileSync(dist('config/db.js'), 'utf8');
  assert.match(db, /if \(last\?\.signature === signature\)\s+return;/);
  assert.match(db, /maxIdleTimeMS: 20000/);
  assert.match(fs.readFileSync(api('_lib/mongo.js'), 'utf8'), /connectionPromise = null;\s+throw err;/);
});
