// Admin → Customers list in English, French and Moroccan Darija: every "cust." text exists in the
// three languages with the same {placeholders}, and the screen reads its texts through useAdminT.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
const admin = await import(pathToFileURL(path.join(root, 'frontend/src/i18n/admin.ts')).href);
const texts = await import(pathToFileURL(path.join(root, 'frontend/src/i18n/adminText/customers.ts')).href);

const keys = Object.keys(texts.en) as string[];
const holes = (s: string) => (s.match(/\{\w+\}/g) || []).sort().join(',');

test('every cust.* text has French and Arabic, with the same placeholders', () => {
  assert.ok(keys.length > 50);
  for (const k of keys) {
    assert.ok(k.startsWith('cust.'), k);
    for (const lang of ['fr', 'ar'] as const) {
      const v = admin.ADMIN_TEXT[lang][k];
      assert.ok(typeof v === 'string' && v.trim(), `${lang} missing ${k}`);
      assert.equal(holes(v), holes(texts.en[k]), `${lang} placeholders of ${k}`);
    }
  }
  // Arabic is written in Arabic letters
  for (const k of keys) assert.match(admin.ADMIN_TEXT.ar[k], /[؀-ۿ]|^[^A-Za-z]*$|PDF|ID|DH/, k);
});

test('the texts fill in and fall back to English', () => {
  assert.equal(admin.adminText('en', 'cust.count', { count: 3 }), '3 customers');
  assert.equal(admin.adminText('fr', 'cust.count', { count: 3 }), '3 clients');
  assert.equal(admin.adminText('ar', 'cust.title'), 'الزبناء');
  assert.equal(admin.adminText('en', 'cust.exportPdf'), 'Export PDF');
});

test('the Customers screen and its parts use the admin texts', () => {
  const page = src('pages/admin/Customers.tsx');
  assert.match(page, /const tr = useAdminT\(\)/);
  assert.match(page, /tr\('cust\.title'\)/);
  for (const f of ['components/admin/customers/CustomerFilters.tsx', 'components/admin/customers/CustomerTable.tsx', 'components/admin/customers/shared.tsx']) {
    assert.match(src(f), /useAdminT\(\)/, f);
  }
  // Segment and type labels are read when shown (getters), not frozen at load
  assert.match(src('components/admin/customers/utils.ts'), /get new\(\) \{ return at\('cust\.seg\.new'\) \}/);
  // Logical sides for right-to-left
  assert.doesNotMatch(src('components/admin/customers/CustomerTable.tsx'), /text-(left|right)\b/);
});
