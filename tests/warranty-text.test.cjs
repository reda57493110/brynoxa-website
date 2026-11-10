// The warranty length depends on the product (its Warranty spec / description): the site never
// promises "6 months", says it only in a few places, and the product page shows the product's own.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_helpers.cjs');

const files = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'dist' ? [] : files(p);
    return /\.(ts|tsx|js|html)$/.test(e.name) && !e.name.startsWith('preview.local') ? [p] : [];
  });

test('no "6-month warranty" promise anywhere (shop, Help, Terms, emails, slips, search engines)', () => {
  const sixMonths = /6[- ]?month[s]? (?:brynoxa )?warranty|warranty \(6 months\)|garantie (?:brynoxa )?(?:de )?6 mois|garantie 6 mois|ضمان (?:Brynoxa )?(?:لمدة )?6 أشهر|ستة أشهر من|six months from/i;
  const found = [];
  for (const f of [...files(path.join(ROOT, 'frontend/src')), path.join(ROOT, 'frontend/index.html'), ...files(path.join(ROOT, 'backend/src'))]) {
    const text = fs.readFileSync(f, 'utf8');
    if (sixMonths.test(text)) found.push(path.relative(ROOT, f));
  }
  assert.deepEqual(found, []);
});

test('said in a few places only; the product page shows the product own warranty', () => {
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  for (const p of ['pages/store/Shop.tsx', 'pages/store/Setups.tsx', 'pages/store/Cart.tsx', 'pages/store/Checkout.tsx']) {
    assert.ok(!/heroPerkWarranty|warrantyFromDelivery|warranty6/.test(src(p)), `${p}: no warranty line`);
  }
  assert.ok(src('pages/store/Home.tsx').includes("'home.heroPerkWarranty'"), 'home header keeps it');
  const product = src('pages/store/ProductDetail.tsx');
  assert.ok(product.includes("formatSpecValue('warranty', p.specs.warranty, locale)"), 'its Warranty spec (2 months, 1 year…)');
  assert.ok(product.includes(": t('home.proofWarranty'),"), 'else the general line');
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    assert.ok(!/proofWarranty: '[^']*\d/.test(t), `${l}: general line without a length`);
  }
});
