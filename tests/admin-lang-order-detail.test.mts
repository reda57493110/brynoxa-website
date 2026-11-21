// Admin → one order, in English / French / Arabic (Darija): every "order." text has all three
// languages with the same {placeholders}, and the order page and its panels use the admin language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
const admin = await import(pathToFileURL(path.join(root, 'frontend/src/i18n/admin.ts')).href);
const T = admin.ADMIN_TEXT as Record<'en' | 'fr' | 'ar', Record<string, string | undefined>>;

const keys = Object.keys(T.en).filter((k) => k.startsWith('order.'));
const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

test('the order page has its texts', () => {
  assert.ok(keys.length > 200, `only ${keys.length} order.* keys`);
});

test('every order.* text has French and Arabic', () => {
  for (const k of keys) {
    for (const lang of ['fr', 'ar'] as const) {
      const v = T[lang][k];
      assert.ok(typeof v === 'string' && v.trim().length > 0, `${lang} missing: ${k}`);
    }
  }
});

test('placeholders are the same in the three languages', () => {
  for (const k of keys) {
    const en = holes(T.en[k]!);
    assert.equal(holes(T.fr[k]!), en, `fr placeholders of ${k}`);
    assert.equal(holes(T.ar[k]!), en, `ar placeholders of ${k}`);
  }
});

test('Arabic texts are written in Arabic letters (except brand names / short codes)', () => {
  const latinOk = new Set(['order.chWhatsapp', 'order.chSms']);
  for (const k of keys) {
    if (latinOk.has(k)) continue;
    const ar = T.ar[k]!.replace(/\{\w+\}/g, '');
    if (!/[A-Za-z]{3,}/.test(T.en[k]!.replace(/\{\w+\}/g, ''))) continue;
    assert.match(ar, /[؀-ۿ]/, `ar not in Arabic letters: ${k}`);
  }
});

test('adminText fills placeholders', () => {
  assert.equal(admin.adminText('en', 'order.failedAttempts', { count: 3 }), '3 failed attempts');
  assert.equal(admin.adminText('fr', 'order.failedAttempts', { count: 3 }), '3 tentatives échouées');
  assert.match(admin.adminText('ar', 'order.rrLate', { days: 20, limit: 14 }), /20.*14/);
});

test('the order page and its panels use the admin language', () => {
  assert.match(src('pages/admin/OrderDetail.tsx'), /useAdminT\(\)/);
  for (const f of [
    'components/admin/OrderWorkflow.tsx',
    'components/admin/OrderDepositPanel.tsx',
    'components/admin/OrderRefundsPanel.tsx',
    'components/admin/OrderReturnPanel.tsx',
    'components/admin/PhoneRiskCard.tsx',
    'components/admin/AskToPay.tsx',
    'components/admin/ReturnRefundButton.tsx',
    'components/admin/ReturnRefundDialog.tsx',
  ]) {
    assert.match(src(f), /useAdminT/, f);
  }
  // English that used to be written in the page is gone
  assert.doesNotMatch(src('pages/admin/OrderDetail.tsx'), />\s*Back to orders\s*</);
  assert.doesNotMatch(src('components/admin/OrderWorkflow.tsx'), /title="History"/);
});
