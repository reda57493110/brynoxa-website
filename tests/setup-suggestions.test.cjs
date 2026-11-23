// Admin → Complete your setup → Suggestions: each suggested product says why (bought together,
// compatible, gaming, best seller, featured, completes the product); staff tick, approve, save.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { rankRecommendations } = require(dist('services/recommendation.service'));

const laptop = { _id: 'main', name: 'Gaming laptop RTX 4060', category: { slug: 'laptops' }, tags: ['gaming'], specs: {} };
const item = (id, name, extra = {}) => ({ _id: id, name, stock: 5, category: { slug: 'accessories' }, tags: [], specs: {}, ...extra });

test('every suggestion carries its reason', () => {
  const ranked = rankRecommendations(
    laptop,
    [
      item('m1', 'Wireless mouse'),
      item('b1', 'Laptop backpack 15.6'),
      item('h1', 'Gaming headset RGB', { tags: ['gaming'] }),
      item('k1', 'Mechanical keyboard', { soldCount: 12 }),
      item('p1', 'Mouse pad XL', { isFeatured: true }),
    ],
    10,
    new Map([['b1', 3]])
  );
  const why = Object.fromEntries(ranked.map((r) => [r._id, r.setupWhy]));
  assert.equal(why.b1, 'together', 'bought together comes first as a reason');
  assert.equal(why.h1, 'gaming', 'a gaming headset for a gaming laptop');
  assert.ok(['bestseller', 'fits', 'compatible'].includes(why.k1));
  assert.ok(ranked.every((r) => ['together', 'compatible', 'gaming', 'bestseller', 'featured', 'fits'].includes(r.setupWhy)));
  assert.ok(!ranked.some((r) => /laptop rtx/i.test(r.name)), 'never another laptop');
});

test('the editor: a Suggestions panel with reasons, tick, approve, add one, hide — with and without picks', () => {
  const ui = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/admin/CompleteSetupAdmin.tsx'), 'utf8');
  assert.ok(ui.includes('function SuggestionsPanel('));
  assert.equal((ui.match(/<SuggestionsPanel/g) || []).length, 2, 'shown when there are picks and when there are none');
  for (const k of ['together', 'compatible', 'gaming', 'bestseller', 'featured', 'fits']) assert.ok(ui.includes(`  ${k}: '`), k);
  assert.ok(ui.includes('Approve {kept.length}'));
  assert.ok(!ui.includes('Automatic for now'), 'no more "Automatic"');
});
