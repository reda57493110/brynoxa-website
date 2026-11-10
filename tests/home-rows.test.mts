import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const rows = await import(pathToFileURL(path.join(root, 'frontend/src/lib/homeRows.ts')).href);

test('Deals facts come from the real prices; New arrivals from the real dates', () => {
  const p = (price: number, compareAtPrice?: number, createdAt?: string) => ({ _id: String(price), price, compareAtPrice, createdAt }) as never;
  assert.equal(rows.bestDiscount([p(4000, 5500), p(950, 1000), p(300)]), 27, '4000 instead of 5500 = 27% off');
  assert.equal(rows.bestDiscount([p(300), p(400, 300)]), 0, 'no real discount');
  assert.equal(rows.latestAdded([p(1, undefined, '2026-11-01T10:00:00Z'), p(2, undefined, '2026-11-07T09:00:00Z'), p(3)])?.toISOString(), '2026-11-07T09:00:00.000Z');
  assert.equal(rows.latestAdded([p(1)]), null);
});

test('budget bands: under 3,000 / 3,000–8,000 / over 8,000 DH; the closing banner is gone', async () => {
  const fs = await import('node:fs');
  assert.deepEqual(rows.BUDGETS.map((b: { id: string }) => b.id), ['small', 'mid', 'high']);
  const band = (price: number) => rows.BUDGETS.find((b: { min?: number; max?: number }) => rows.inBudget(price, b))?.id;
  assert.equal(band(2999), 'small');
  assert.equal(band(3000), 'mid');
  assert.equal(band(7999), 'mid');
  assert.equal(band(8000), 'high');
  const home = fs.readFileSync(path.join(root, 'frontend/src/pages/store/Home.tsx'), 'utf8');
  assert.ok(!home.includes('home-cta-heading') && !home.includes('CTA_STEPS'), 'closing banner removed');
  assert.match(home, /<HomeBudget budgets=\{rows\.budgets\} total=\{rows\.budgetTotal\} \/>\n    <\/>\n  \)\n\}\s*$/, 'budget is the last section before the footer');
});

test('New arrivals uses bigger cards; budget section has cards with count and "from" price', async () => {
  const fs = await import('node:fs');
  const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
  assert.ok(src('components/home/HomeProductRow.tsx').includes("size={tone === 'new' ? 'lg' : 'md'}"));
  assert.ok(src('components/product/ProductCarousel.tsx').includes("sm:w-[21.5rem]"));
  const b = src('components/home/HomeBudget.tsx');
  for (const k of ["t('home.budgetCount'", "t('home.budgetFrom'", "t('home.budgetShowing'", 'BAND_ICON', 'id="home-budget-panel"']) assert.ok(b.includes(k), k);
  assert.equal((b.match(/to=\{shopLink\}/g) || []).length, 1, 'one "see all" button');
});

test('phone: budget cards are 3 small tiles in one row; products are big cards sliding sideways', async () => {
  const fs = await import('node:fs');
  const b = fs.readFileSync(path.join(root, 'frontend/src/components/home/HomeBudget.tsx'), 'utf8');
  assert.ok(b.includes('className="mt-5 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3"'), 'three tiles side by side, no sideways scroll');
  assert.ok(!b.includes('w-[15.5rem]'), 'no wide budget cards');
  assert.ok(!b.includes('grid grid-cols-2 gap-2.5'), 'no two small products per line on phones');
  assert.ok(b.includes('w-[min(17.5rem,78vw)] shrink-0 snap-start sm:w-auto'), 'big product cards on phones');
});
