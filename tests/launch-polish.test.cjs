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
  const shop = src('components/admin/ShopHeaderBoard.tsx');
  assert.ok(!shop.includes('The product at the top of the Shop page changes'));
  assert.ok(!shop.includes('one product per category, in turn (default)'));
  assert.ok(shop.includes("'rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/25 p-2.5 sm:flex sm:items-center sm:gap-3'"), 'stacked on phones');
  const board = src('components/admin/HomeLayoutBoard.tsx');
  assert.ok(!board.includes('Each setup fills itself'));
  assert.ok(!board.includes('auto: ticks, category and words'));
});

test('said once: no small labels repeating the page title; no repeats on product, Help, Contact', () => {
  assert.ok(src('components/layout/PageHero.tsx').includes('{void kicker}'), 'page headers: title only');
  assert.ok(src('components/layout/StoreHero.tsx').includes('{void kicker}'), 'shop headers: title only');
  assert.ok(src('components/home/HomeProductRow.tsx').includes('{void kicker}'), 'home rows: title only');
  assert.ok(!src('pages/store/Home.tsx').includes("t('home.featuredKicker')"));
  assert.ok(!src('pages/store/ProductDetail.tsx').includes('{p.sku}'), 'product: no SKU / category line (the path shows the category)');
  assert.ok(!src('pages/store/Help.tsx').includes('{guide.title}</h3>'), 'Help: the tab names the guide');
  assert.ok(!src('pages/store/Contact.tsx').includes('href="#message"'), 'Contact: the form is right there');
});

test('Shop by budget on computers: three per row, two full rows', () => {
  const b = src('components/home/HomeBudget.tsx');
  assert.ok(b.includes('const SHOWN = 6'));
  assert.ok(b.includes('<div className="grid grid-cols-2 gap-4 lg:grid-cols-3">'));
});
