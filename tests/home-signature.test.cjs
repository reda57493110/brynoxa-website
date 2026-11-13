// Home: "Brynoxa Signature" — products with the Brynoxa touch, between Our top picks and Shop by
// budget. Staff choose them in Admin → Products → Home page (Settings → homeRows.signature);
// otherwise the in-stock Brynoxa-brand products. Hidden under 2 products.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');

test('server: the Signature choice is saved like the other home sections (12 at most)', () => {
  const { sanitizeHomeRows, HOME_ROW_KEYS } = require(dist('models/Settings.js'));
  assert.ok(HOME_ROW_KEYS.includes('signature'));
  const ids = Array.from({ length: 15 }, (_, i) => String(i).padStart(24, 'a'));
  assert.equal(sanitizeHomeRows({ signature: ids }).signature.length, 12);
  assert.equal(sanitizeHomeRows({ signature: [] }, { signature: [ids[0]] }).signature, undefined, 'empty = back to automatic');
});

test('shop: own section, after the top picks and before the budgets; Brynoxa products by default', () => {
  const home = src('pages/store/Home.tsx');
  const pos = ['{/* Featured */}', '<HomeSignature products={rows.signature} />', '<HomeBudget budgets'].map((m) => home.indexOf(m));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), pos.join(','));
  const hook = src('hooks/useHomeRows.ts');
  assert.ok(hook.includes("productsApi.list({ brand: SIGNATURE_BRAND, inStock: true, sort: 'popular', limit: 12 })"));
  assert.ok(hook.includes("export const SIGNATURE_BRAND = 'brynoxa'"));
  const section = src('components/home/HomeSignature.tsx');
  assert.ok(section.includes('if (products.length < SIGNATURE_MIN) return null'));
  assert.ok(section.includes('to={`/shop?brand=${SIGNATURE_BRAND}`}'), 'see all opens the Brynoxa products in the shop');
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['signatureBadge', 'signatureTitle', 'signatureBody', 'signatureViewAll']) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});

test('admin board: Brynoxa Signature is step 4, between Carousel and Budget', () => {
  const board = src('components/admin/HomeLayoutBoard.tsx');
  assert.ok(board.includes("store={{ kind: 'homeRows', key: 'signature' }}"));
  const order = ['title="Carousel"', 'title="Brynoxa Signature"', 'title={`Budget · '].map((m) => board.indexOf(m));
  assert.ok(order.every((p, i) => p > 0 && (i === 0 || p > order[i - 1])), order.join(','));
});
