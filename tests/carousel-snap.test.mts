// Product carousels (home rows, setups on phones): Pause stops on a whole product, and ‹ › move
// exactly one product and land on it — centred on phones, at the left edge on wider screens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const c = await import(pathToFileURL(path.join(root, 'frontend/src/lib/carousel.ts')).href);

test('phone (one card fits): the product is centred; wider screens: left edge', () => {
  // phone: 358 px wide, cards 280 px + 16 px gap
  assert.equal(c.cardOffset(0, 296, 358, 280), 39, 'centred: (358 − 280) / 2');
  assert.equal(c.cardOffset(2, 296, 358, 280), 39 - 2 * 296);
  // computer: 1200 px wide, 3+ cards fit
  assert.equal(c.cardOffset(3, 312, 1200, 296), -3 * 312);
});

test('the nearest product to where the row stopped', () => {
  const step = 296;
  const at = (i: number) => c.cardOffset(i, step, 358, 280);
  assert.equal(c.nearestCard(at(4), step, 358, 280), 4);
  assert.equal(c.nearestCard(at(4) - 100, step, 358, 280), 4, 'a third of the way to the next: stays');
  assert.equal(c.nearestCard(at(4) - 200, step, 358, 280), 5, 'two thirds: the next one');
  assert.equal(c.nearestCard(-500, 0, 358, 280), 0, 'not measured yet');
});

test('the carousel uses them: Pause snaps, arrows glide one product and hold the auto scroll', () => {
  const src = fs.readFileSync(path.join(root, 'frontend/src/components/product/ProductCarousel.tsx'), 'utf8');
  assert.ok(src.includes('if (next) snapToNearest()'), 'Pause lands on a whole product');
  assert.ok(src.includes('const i = nearestCard(offsetRef.current, step, viewport, card) - direction'), 'one product per arrow');
  assert.ok(src.includes('holdUntilRef.current = performance.now() + ARROW_HOLD_MS'), 'the auto scroll waits after an arrow');
  assert.ok(src.includes('glideRef.current === null && performance.now() > holdUntilRef.current'));
  // One product = card + gap, measured exactly (an estimate made every stop creep a few pixels)
  assert.ok(src.includes('stepRef.current = products.length > 1 ? (track.scrollWidth + gap) / loop.length : 0'));
  assert.ok(src.includes('halfRef.current = stepRef.current * products.length'));
});

test('Grab your setup: "See all" per group and a "see all products" box', () => {
  const page = fs.readFileSync(path.join(root, 'frontend/src/pages/store/Setups.tsx'), 'utf8');
  assert.ok(page.includes("to={mainCategoryOf(g.items) ? `/shop?category=${mainCategoryOf(g.items)}` : '/shop'}"));
  assert.ok(page.includes("{t('setups.moreCta')}") && page.includes('to="/shop"'));
  for (const l of ['en', 'fr', 'ar']) {
    const t = fs.readFileSync(path.join(root, `frontend/src/i18n/${l}.ts`), 'utf8');
    for (const k of ['seeAll', 'moreTitle', 'moreBody', 'moreCta']) assert.ok(t.includes(`\n    ${k}: '`), `${l}: ${k}`);
  }
});
