// Product page, "Complete your setup" on phones: cards as wide as the other carousels (not two
// tiny ones per screen), with a readable name and price.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_helpers.cjs');

test('Complete your setup: phone cards about 224 px, readable text', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/src/components/product/CompleteSetup.tsx'), 'utf8');
  assert.ok(src.includes('<div key={product._id} className="w-[min(14rem,62vw)] shrink-0 snap-start">'), 'same width as the carousels');
  assert.ok(!src.includes('w-[38vw]'), 'not two tiny cards per screen');
  assert.ok(src.includes('line-clamp-2 min-h-[2.5rem] text-sm font-medium'), 'name: readable on phones');
  assert.ok(src.includes('<span className="block text-base font-bold tabular-nums'), 'price: readable on phones');
});
