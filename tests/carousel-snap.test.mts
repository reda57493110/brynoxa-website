// The product rows are rows you swipe (HomeShelf), with the same cards everywhere; the old
// moving carousel is gone (Nov 2026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('Grab your setup: "See all" per group and a "see all products" box', () => {
  const page = fs.readFileSync(path.join(root, 'frontend/src/pages/store/Setups.tsx'), 'utf8');
  assert.ok(page.includes("viewAll={{ to: slug ? `/category/${slug}` : '/shop', label: t('setups.seeAll') }}"), 'See all opens the category page');
  assert.ok(page.includes("{t('setups.moreCta')}") && page.includes('to="/shop"'));
  for (const l of ['en', 'fr', 'ar']) {
    const t = fs.readFileSync(path.join(root, `frontend/src/i18n/${l}.ts`), 'utf8');
    for (const k of ['seeAll', 'moreTitle', 'moreBody', 'moreCta']) assert.ok(t.includes(`\n    ${k}: '`), `${l}: ${k}`);
  }
});

test('the old moving carousel is gone; every product row uses the swipe row and the same cards', () => {
  for (const f of ['components/product/ProductCarousel.tsx', 'lib/carousel.ts']) assert.ok(!fs.existsSync(path.join(root, 'frontend/src', f)), f);
  const shelf = fs.readFileSync(path.join(root, 'frontend/src/components/home/HomeShelf.tsx'), 'utf8');
  assert.ok(shelf.includes('<HomeShopCard product={p}'));
});
