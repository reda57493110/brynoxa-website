// Shop search: words also match the processor and graphics card ("i7", "rtx 4060").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

test('search looks in the product specs (processor, graphics card)', () => {
  const src = fs.readFileSync(dist('services/catalog.service.js'), 'utf8');
  assert.match(src, /'specs\.cpu': rx/);
  assert.match(src, /'specs\.gpu': rx/);
});
