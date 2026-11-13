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
  // Order: header, categories, top picks, budget, deals, new arrivals (then the footer)
  const pos = ['{/* Categories:', '{/* Featured */}', '<HomeBudget budgets', 'id="deals"', 'id="new-arrivals"'].map((m) => home.indexOf(m));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), 'home order: ' + pos.join(','));
});

test('New arrivals uses bigger cards; budget section has cards with count and "from" price', async () => {
  const fs = await import('node:fs');
  const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
  assert.ok(src('components/home/HomeProductRow.tsx').includes('<ProductCarousel products={products} />'), 'same size as every carousel');
  const b = src('components/home/HomeBudget.tsx');
  for (const k of ["t('home.budgetCount'", "t('home.budgetFrom'", "t('home.budgetShowing'", 'BAND_ICON', 'id="home-budget-panel"']) assert.ok(b.includes(k), k);
  assert.equal((b.match(/to=\{shopLink\}/g) || []).length, 1, 'one "see all" button');
});

test('phone: budget tiles are 3 small tiles in one row; products slide by themselves like the other rows', async () => {
  const fs = await import('node:fs');
  const b = fs.readFileSync(path.join(root, 'frontend/src/components/home/HomeBudget.tsx'), 'utf8');
  assert.ok(b.includes('className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-6 sm:gap-3"'), 'three tiles side by side, no sideways scroll');
  assert.ok(!b.includes('w-[15.5rem]'), 'no wide budget cards');
  assert.ok(b.includes("const isPhone = !useMediaQuery('(min-width: 640px)')"), 'phone detected');
  assert.ok(b.includes('<ProductCarousel key={own ?? active.id} products={items} />'), 'phones: the moving carousel');
  assert.ok(b.includes('grid grid-cols-2 gap-4 lg:grid-cols-3"'), 'tablets / computers: a grid, 3 per row on computers');
});

test('own budget: the customer types an amount; best in-stock products up to it, dearest first', async () => {
  assert.equal(rows.ownBudgetAmount('5000'), 5000);
  assert.equal(rows.ownBudgetAmount('5 000'), 5000);
  assert.equal(rows.ownBudgetAmount('5,000'), 5000);
  assert.equal(rows.ownBudgetAmount('5.000'), 5000);
  assert.equal(rows.ownBudgetAmount(''), null, 'empty');
  assert.equal(rows.ownBudgetAmount('20'), null, 'below 50 DH');
  assert.equal(rows.ownBudgetAmount('999999999'), 1000000, 'capped');
  const fs = await import('node:fs');
  const b = fs.readFileSync(path.join(root, 'frontend/src/components/home/HomeBudget.tsx'), 'utf8');
  assert.ok(b.includes("productsApi.list({ maxPrice: own ?? undefined, inStock: true, sort: 'price_desc', limit: SHOWN })"), 'server query');
  assert.ok(b.includes("sort: own !== null ? 'price_desc' : 'price_asc'"), 'shop link matches');
  const svc = fs.readFileSync(path.join(root, 'backend/src/services/catalog.service.ts'), 'utf8');
  assert.ok(svc.includes('(filter.price as Record<string, number>).$lte = query.maxPrice'), 'a product at exactly the budget is included');
  for (const l of ['en', 'fr', 'ar']) {
    const t = fs.readFileSync(path.join(root, `frontend/src/i18n/${l}.ts`), 'utf8');
    for (const k of ['budgetOwnTitle', 'budgetOwnPlaceholder', 'budgetOwnShow', 'budgetOwnClear', 'budgetOwnLabel', 'budgetOwnEmpty']) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});

test('phones: New arrivals and Shop by budget use small titles and normal-size cards', async () => {
  const fs = await import('node:fs');
  const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
  const row = src('components/home/HomeProductRow.tsx');
  assert.ok(row.includes('font-display text-lg font-semibold leading-tight tracking-tight sm:mt-2 sm:text-4xl'), 'row title: small on phones');
  assert.ok(row.includes("'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10.5px]"), 'small fact chips');
  const carousel = src('components/product/ProductCarousel.tsx');
  assert.ok(carousel.includes("export const CAROUSEL_CARD = 'relative w-[min(14rem,62vw)] shrink-0 sm:w-[17.5rem]'"), 'one card size for every carousel (Shop by budget)');
  const budget = src('components/home/HomeBudget.tsx');
  assert.ok(budget.includes('font-display text-lg font-semibold leading-tight tracking-tight sm:mt-2 sm:text-4xl'), 'budget title: small on phones');
  assert.ok(budget.includes('h-10 w-full rounded-full'), 'budget input: smaller on phones');
});

test('home categories: Desktop PC, Laptops, Gaming PCs, Monitors only, then "See more categories" to the shop', async () => {
  const fs = await import('node:fs');
  const home = fs.readFileSync(path.join(root, 'frontend/src/pages/store/Home.tsx'), 'utf8');
  assert.ok(home.includes("const HOME_CATEGORIES = ['desktop-pcs', 'laptops', 'gaming-pcs', 'monitors']"));
  assert.ok(home.includes('HOME_CATEGORIES.map((slug) => categoryList.find((c) => canonicalCategorySlug(c.slug) === slug))'), 'desktop-pc counts as desktop-pcs');
  assert.ok(home.includes('homeCategories.map((c, i) => {'));
  const i = home.indexOf("{t('home.seeMoreCategories')}");
  assert.ok(i > 0 && home.slice(i - 500, i).includes('to="/shop"'), 'the button opens the shop');
  for (const l of ['en', 'fr', 'ar']) assert.ok(fs.readFileSync(path.join(root, `frontend/src/i18n/${l}.ts`), 'utf8').includes("    seeMoreCategories: '"), l);
});

test('phones: Shop by budget without its long sentence, small price ranges; a short footer', async () => {
  const fs = await import('node:fs');
  const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
  const budget = src('components/home/HomeBudget.tsx');
  assert.ok(budget.includes("hidden text-base leading-relaxed text-[var(--fg-muted)] sm:block\">{t('home.budgetBody')}"), 'the sentence only on tablets / computers');
  assert.ok(budget.includes('block font-display text-[11px] font-semibold leading-tight sm:mt-0.5 sm:text-xl'), 'small price ranges on phones');
  const footer = src('components/layout/Footer.tsx');
  for (const gone of ["'footer.warranty'", "'footer.returns'", "t('footer.warrantyBadge')", "t('footer.noCard')"]) assert.ok(!footer.includes(gone), gone);
  assert.ok(footer.includes("{ to: '/help', key: 'help.kicker' as const }"), 'Help stays (warranty and returns are there)');
});

test('phones: home categories are a compact 2×2 (small photo, name only); admin board follows the page order', async () => {
  const fs = await import('node:fs');
  const home = fs.readFileSync(path.join(root, 'frontend/src/pages/store/Home.tsx'), 'utf8');
  assert.ok(home.includes('<div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">'));
  assert.ok(home.includes("featuredTile ? 'h-24 sm:h-auto sm:min-h-[10.5rem] sm:flex-1' : 'h-24 sm:h-48'"));
  assert.ok(home.includes('mt-1.5 line-clamp-2 hidden max-w-sm'), 'descriptions from tablets up');
  const board = fs.readFileSync(path.join(root, 'frontend/src/components/admin/HomeLayoutBoard.tsx'), 'utf8');
  const order = ['title="Hero"', 'title="Featured (#1 = big card)"', 'title="Carousel"', 'title={`Budget · ', 'title="Deals"', 'title="New arrivals"'].map((m) => board.indexOf(m));
  assert.ok(order.every((p, i) => p > 0 && (i === 0 || p > order[i - 1])), 'board order: ' + order.join(','));
});
