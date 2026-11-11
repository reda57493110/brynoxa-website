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
