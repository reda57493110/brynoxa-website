// Launch polish: the site is dark only (no light / dark switch); the dashboard never shows a red
// "▼ 100%" when a period has nothing (all refunded); the admin storefront board is short on phones.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_helpers.cjs');
const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');

test('dark only: no theme switch, and a saved light theme is ignored', () => {
  for (const f of ['components/layout/AdminTopbar.tsx', 'components/layout/MobileNav.tsx']) assert.ok(!src(f).includes('toggleTheme'), f);
  assert.ok(src('themeInit.ts').includes("const theme = 'dark'"));
  const store = src('store/themeStore.ts');
  assert.ok(store.includes("state.theme = 'dark'") && store.includes("applyTheme('dark')"));
});

test('dashboard: a period with nothing (all refunded) is a plain note, not a red drop', () => {
  const kit = src('components/admin/analytics/Kit.tsx');
  const i = kit.indexOf('if (now === 0)');
  assert.ok(i > 0 && i < kit.indexOf("text-[var(--danger)]"), 'checked before the red arrow');
  assert.ok(kit.includes('None this period'));
});

test('admin board on phones: no long explanations, short labels', () => {
  const board = src('components/admin/HomeLayoutBoard.tsx');
  assert.ok(!board.includes('Each setup fills itself'));
  assert.ok(!board.includes('auto: ticks, category and words'));
});

test('said once: no small labels repeating the page title; no repeats on product, Help, Contact', () => {
  assert.ok(src('components/layout/PageHero.tsx').includes('{void kicker}'), 'page headers: title only');
  assert.ok(src('components/layout/StoreHero.tsx').includes('{void kicker}'), 'shop headers: title only');
  assert.ok(!src('pages/store/Home.tsx').includes("t('home.featuredKicker')"));
  assert.ok(!src('pages/store/ProductDetail.tsx').includes('{p.sku}'), 'product: no SKU / category line (the path shows the category)');
  assert.ok(!src('pages/store/Help.tsx').includes('{guide.title}</h3>'), 'Help: the tab names the guide');
  assert.ok(!src('pages/store/Contact.tsx').includes('href="#message"'), 'Contact: the form is right there');
});


test('shop filters (like the big shops): Category, Price (4 ranges or own min / max), Availability, Brand; one Reset', () => {
  const f = src('components/shop/ShopFilters.tsx');
  for (const k of ["t('shop.category')", "t('shop.priceDh')", "t('shop.availability')", "t('shop.brand')", "t('shop.resetFilters')", 'PRICE_PRESETS.map', "t('shop.inStockOnly')", "t('shop.onSaleOnly')"]) assert.ok(f.includes(k), k);
  assert.ok(f.includes('if (lo && hi && Number(lo) > Number(hi)) [lo, hi] = [hi, lo]'), 'a min above the max is swapped');
  assert.ok(f.includes("role={round ? 'radio' : 'checkbox'}") && f.includes('aria-checked={on}'), 'screen readers hear the choices');
});

test('Shop by budget: one card per price range and one to type a budget, four in a row on computers', () => {
  const b = src('components/home/HomeBlocks.tsx');
  assert.ok(b.includes('<ul className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">'));
  assert.ok(b.includes('<label htmlFor="home-own-budget"'), 'the budget box has its label');
});
