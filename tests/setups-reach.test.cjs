// The "Pick your setup" page can be reached from more than the home header's button: the top menu,
// the phone menu, the footer, a strip of the four setups on the home page, and a line in the shop.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_helpers.cjs');
const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');

test('menus and footer link to /setups', () => {
  assert.ok(src('components/layout/Navbar.tsx').includes("{ to: '/setups', label: t('common.setups') },"));
  assert.ok(src('components/layout/MobileNav.tsx').includes("{ to: '/setups', label: t('common.setups'), icon: 'monitor' },"));
  assert.ok(src('components/layout/Footer.tsx').includes("{ to: '/setups', key: 'common.setups' as const },"));
});

test('home: the four setups, each opening its own page, right after the categories', () => {
  const strip = src('components/home/HomeSetups.tsx');
  assert.ok(strip.includes('to={`/setups/${id}`}') && strip.includes('SETUP_IDS.map'));
  const home = src('pages/store/Home.tsx');
  const pos = ['{/* Categories:', '<HomeSetups />', '{/* Featured */}'].map((m) => home.indexOf(m));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), pos.join(','));
});

test('shop: "Not sure what to pick? Choose your setup" above the products (first page, no search)', () => {
  const shop = src('pages/store/Shop.tsx');
  assert.ok(shop.includes("{!filters.q && filters.page === 1 ? (") && shop.includes('to="/setups"'));
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['    setups: \'', '    hintQuestion: \'', '    hintLink: \'']) assert.ok(t.includes(k), `${l}: ${k}`);
  }
});
