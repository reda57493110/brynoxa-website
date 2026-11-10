// Admin → Products: the "Grab your setup page" tab. Each setup is a card with its groups; staff
// rank, move, edit, remove and add products. Saved in Settings → homeRows['setup-gaming'] …
// (48 products at most); empty = back to automatic.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

test('server: setups are saved like the home rows, 48 products each; home rows stay 12', () => {
  const { sanitizeHomeRows, HOME_ROW_KEYS } = require(dist('models/Settings.js'));
  for (const k of ['setup-gaming', 'setup-study', 'setup-work', 'setup-creator']) assert.ok(HOME_ROW_KEYS.includes(k), k);
  const ids = Array.from({ length: 60 }, (_, i) => String(i).padStart(24, 'a'));
  const out = sanitizeHomeRows({ 'setup-gaming': ids, new: ids, 'setup-hacker': ids }, { 'setup-work': [ids[0]] });
  assert.equal(out['setup-gaming'].length, 48);
  assert.equal(out.new.length, 12);
  assert.equal(out['setup-hacker'], undefined);
  assert.deepEqual(out['setup-work'], [ids[0]], 'setups not sent are kept');
  assert.equal(sanitizeHomeRows({ 'setup-gaming': [] }, { 'setup-gaming': [ids[0]] })['setup-gaming'], undefined, 'empty = automatic');
  const { settingsSchema, paginationQuerySchema } = require(dist('validators/schemas.js'));
  assert.ok(settingsSchema.shape.homeRows.safeParse({ 'setup-gaming': ids.slice(0, 48) }).success, 'the form accepts 48');
  assert.ok(paginationQuerySchema.safeParse({ ids: ids.slice(0, 48).join(',') }).success, '48 ids fit in the address');
  const svc = fs.readFileSync(path.join(ROOT, 'backend/src/services/catalog.service.ts'), 'utf8');
  assert.ok(svc.includes('.filter((x) => looksLikeObjectId(x)).slice(0, 48);'));
  // The live-site settings function uses the same sanitizer for homeRows
  assert.ok(fs.readFileSync(api('v1/settings.js'), 'utf8').includes('settings[key] = sanitizeHomeRows(body[key], settings.homeRows);'));
});

test('admin board: two tabs (Home page, Grab your setup page); a card per setup with its groups', () => {
  const board = fs.readFileSync(path.join(ROOT, 'frontend/src/components/admin/HomeLayoutBoard.tsx'), 'utf8');
  for (const t of ["label: 'Home page'", "label: 'Grab your setup page'", 'role="tablist"', 'const lists = useSetupLists()', "store={{ kind: 'setup', key, all }}", 'Add a product', 'Back to automatic', 'title="Place on the page"']) {
    assert.ok(board.includes(t), t);
  }
  assert.ok(board.includes('const list = reset ? [] : setupListAfter(store.all, ids, next).slice(0, MAX_SETUP_ROW)'), 'a group change saves the whole setup');
  const hook = fs.readFileSync(path.join(ROOT, 'frontend/src/hooks/useSetupLists.ts'), 'utf8');
  assert.ok(hook.includes('const chosen = settings.data?.homeRows ?? {}'));
  assert.ok(hook.includes("export const setupRowKey = (id: SetupId) => `setup-${id}` as const"));
  assert.ok(hook.includes('p && p.stock > 0'), 'sold out chosen products are skipped on the page');
});
