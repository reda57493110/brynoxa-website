import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const rows = await import(pathToFileURL(path.join(root, 'frontend/src/lib/homeRows.ts')).href);
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');

test('Deals facts come from the real prices; New arrivals from the real dates', () => {
  const p = (price: number, compareAtPrice?: number, createdAt?: string) => ({ _id: String(price), price, compareAtPrice, createdAt }) as never;
  assert.equal(rows.bestDiscount([p(4000, 5500), p(950, 1000), p(300)]), 27, '4000 instead of 5500 = 27% off');
  assert.equal(rows.bestDiscount([p(300), p(400, 300)]), 0, 'no real discount');
  assert.equal(rows.latestAdded([p(1, undefined, '2026-11-01T10:00:00Z'), p(2, undefined, '2026-11-07T09:00:00Z'), p(3)])?.toISOString(), '2026-11-07T09:00:00.000Z');
  assert.equal(rows.latestAdded([p(1)]), null);
});

test('budget bands: under 3,000 / 3,000–8,000 / over 8,000 DH; the closing banner is gone', () => {
  assert.deepEqual(rows.BUDGETS.map((b: { id: string }) => b.id), ['small', 'mid', 'high']);
  const band = (price: number) => rows.BUDGETS.find((b: { min?: number; max?: number }) => rows.inBudget(price, b))?.id;
  assert.equal(band(2999), 'small');
  assert.equal(band(3000), 'mid');
  assert.equal(band(7999), 'mid');
  assert.equal(band(8000), 'high');
  const home = src('pages/store/Home.tsx');
  assert.ok(!home.includes('home-cta-heading') && !home.includes('CTA_STEPS'), 'closing banner removed');
});

test('budget cards: count and "from" price per band, each opening the shop on that price range (in stock)', () => {
  const b = src('components/home/HomeBlocks.tsx');
  for (const k of ["t('home.budgetCount'", "t('home.budgetFrom'", "t('home.budgetSeeAll')", 'BAND_ICON', 'id="budget"']) assert.ok(b.includes(k), k);
  assert.ok(b.includes("const bands = budgets.filter((b) => b.items.length)"), 'empty bands hidden');
  assert.ok(b.includes("sort, inStock: 'true' })}`"), 'the shop link keeps the range, the order and "in stock"');
});

test('own budget: the customer types an amount and lands in the shop up to it, dearest first', () => {
  assert.equal(rows.ownBudgetAmount('5000'), 5000);
  assert.equal(rows.ownBudgetAmount('5 000'), 5000);
  assert.equal(rows.ownBudgetAmount('5,000'), 5000);
  assert.equal(rows.ownBudgetAmount('5.000'), 5000);
  assert.equal(rows.ownBudgetAmount(''), null, 'empty');
  assert.equal(rows.ownBudgetAmount('20'), null, 'below 50 DH');
  assert.equal(rows.ownBudgetAmount('999999999'), 1000000, 'capped');
  const b = src('components/home/HomeBlocks.tsx');
  assert.ok(b.includes("if (own !== null) navigate(link(undefined, own, 'price_desc'))"));
  const svc = fs.readFileSync(path.join(root, 'backend/src/services/catalog.service.ts'), 'utf8');
  assert.ok(svc.includes('(filter.price as Record<string, number>).$lte = query.maxPrice'), 'a product at exactly the budget is included');
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['budgetOwnTitle', 'budgetOwnPlaceholder', 'budgetOwnShow']) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});

test('home categories: Desktop PC, Laptops, Gaming PCs, Monitors first, then the others; "See more categories" opens the shop', () => {
  const home = src('pages/store/Home.tsx');
  assert.ok(home.includes("const HOME_CATEGORIES = ['desktop-pcs', 'laptops', 'gaming-pcs', 'monitors']"));
  assert.ok(home.includes('HOME_CATEGORIES.map((slug) => categoryList.find((c) => canonicalCategorySlug(c.slug) === slug))'), 'desktop-pc counts as desktop-pcs');
  const hero = src('components/home/HomeHero.tsx');
  const i = hero.indexOf("{t('home.seeMoreCategories')}");
  assert.ok(i > 0 && hero.slice(i - 300, i).includes('to="/shop"'), 'the menu link opens the shop');
  for (const l of ['en', 'fr', 'ar']) assert.ok(src(`i18n/${l}.ts`).includes("    seeMoreCategories: '"), l);
});

test('a short footer (warranty and returns are in Help)', () => {
  const footer = src('components/layout/Footer.tsx');
  for (const gone of ["'footer.warranty'", "'footer.returns'", "t('footer.warrantyBadge')", "t('footer.noCard')"]) assert.ok(!footer.includes(gone), gone);
  assert.ok(footer.includes("{ to: '/help', key: 'help.kicker' as const }"), 'Help stays (warranty and returns are there)');
});

test('admin board lists the home lists in the order and with the names of the home page', () => {
  const board = src('components/admin/HomeLayoutBoard.tsx');
  // Section names are in the admin language: the keys in board order, their English names in products.ts
  const keys = ['products.board.dealsBanner', 'products.dealsMoment', 'products.board.topFirst', 'products.board.topThen', 'products.board.newArrivals', 'products.signature', 'products.board.budget'];
  const order = keys.map((k) => board.indexOf(`title={tr('${k}'`));
  const texts = src('i18n/adminText/products.ts');
  const names = ['Deals banner (top of the page)', 'Deals of the moment', 'Our selection · Top picks (first)', 'Our selection · Top picks (then)', 'Our selection · New arrivals', 'Brynoxa Signature', 'Shop by budget · {band}'];
  keys.forEach((k, i) => assert.ok(texts.includes(`'${k}': '${names[i]}'`), k));
  assert.ok(order.every((p, i) => p > 0 && (i === 0 || p > order[i - 1])), 'board order: ' + order.join(','));
  assert.ok(board.includes("import { HOME_ROW_MIN, SIGNATURE_MIN } from '@/components/home/HomeBlocks'"));
});
