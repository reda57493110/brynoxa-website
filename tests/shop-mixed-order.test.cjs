// Shop "Recommended" (the default when browsing everything): one product of each kind in turn,
// so a gaming PC, a laptop, a desktop, a monitor… come before a second laptop. Both server paths.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

test('mixed order: one of each main category per round, newest first inside a kind', () => {
  const { mixByCategory } = require(dist('utils/mixByCategory.js'));
  const main = { 'gaming-laptops': 'laptops', laptops: 'laptops', 'gaming-pcs': 'gaming-pcs', monitors: 'monitors', mice: 'accessories' };
  const p = (id, category, t) => ({ id, category, createdAt: t });
  const order = mixByCategory(
    [p('lap1', 'laptops', 100), p('lap2', 'laptops', 90), p('lap3', 'gaming-laptops', 80), p('pc1', 'gaming-pcs', 95), p('pc2', 'gaming-pcs', 50), p('mon1', 'monitors', 70), p('mouse1', 'mice', 60)],
    (c) => main[c] ?? 'none'
  );
  assert.deepEqual(order, ['lap1', 'pc1', 'mon1', 'mouse1', 'lap2', 'pc2', 'lap3']);
  for (let i = 1; i < 4; i++) assert.notEqual(main[order[i]] ?? order[i].slice(0, 3), main[order[i - 1]] ?? order[i - 1].slice(0, 3));
  assert.deepEqual(mixByCategory([], () => 'x'), []);
});

test('server: sort=mixed pages the mixed list; the shop uses it by default; preload follows', async () => {
  const svc = fs.readFileSync(path.join(ROOT, 'backend/src/services/catalog.service.ts'), 'utf8');
  assert.ok(svc.includes("if (query.sort === 'mixed' && !query.featured && !query.carousel) {"));
  assert.ok(svc.includes('const pageIds = order.slice(skip, skip + query.limit);'));
  assert.ok(fs.readFileSync(api('v1/products.js'), 'utf8').includes('sort: raw.sort,'), 'the live-site function passes it on');
  const shop = fs.readFileSync(path.join(ROOT, 'frontend/src/pages/store/Shop.tsx'), 'utf8');
  assert.ok(shop.includes("sort: params.get('sort') || 'mixed',"));
  assert.ok(fs.readFileSync(path.join(ROOT, 'frontend/src/lib/constants.ts'), 'utf8').includes("{ value: 'mixed', label: 'Recommended' },"));
  assert.ok(fs.readFileSync(path.join(ROOT, 'frontend/public/preload.js'), 'utf8').includes("'products?page=1&limit=12&sort=mixed'"));
  for (const l of ['en', 'fr', 'ar']) assert.ok(fs.readFileSync(path.join(ROOT, `frontend/src/i18n/${l}.ts`), 'utf8').includes("    mixed: '"), l);
});

test('launch clean-up: no repeated promises or titles that repeat the title', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  assert.ok(!src('pages/store/Shop.tsx').includes("t('home.heroPerkCod')"), 'shop: no cash chip');
  assert.ok(!src('pages/store/Setups.tsx').includes("t('home.heroPerkCod')"), 'setups: no cash line');
  const services = src('pages/store/Services.tsx');
  assert.ok(!services.includes('heroTrustChip') && !services.includes('HERO_PROOF'), 'services: no badge, no chips');
  const contact = src('pages/store/Contact.tsx');
  assert.ok(!contact.includes('HERO_PROOF') && !contact.includes("t('contact.messageKicker')"), 'contact: no chips, no repeat heading');
  assert.ok(!contact.includes('contact-faq-heading') && contact.includes("{t('contact.helpLine')}"), 'contact: questions are in the Help Center');
  assert.ok(src('pages/store/TrackOrder.tsx').includes("<PageHero title={t('orders.trackHeading')}"), 'track: no "Cash on delivery" heading');
  assert.ok(!src('pages/store/Home.tsx').includes("t('home.categoriesKicker')"));
  assert.ok(!src('components/home/HomeBudget.tsx').includes("t('home.budgetKicker')"));
});
