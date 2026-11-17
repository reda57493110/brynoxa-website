// French / Arabic product descriptions: typed in admin, shown on /fr and /ar; empty = the main text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const { withProductText } = await import(pathToFileURL(path.join(root, 'frontend/src/lib/productText.ts')).href);
const require = createRequire(import.meta.url);

const product = {
  description: 'Fast response, thin bezels.',
  shortDescription: '27" OLED 240 Hz',
  translations: { fr: { description: 'Réponse rapide, bordures fines.', shortDescription: '' }, ar: { description: '', shortDescription: '' } },
};

test('French page: the French text; an empty French field falls back to the main text', () => {
  const fr = withProductText(product, 'fr');
  assert.equal(fr.description, 'Réponse rapide, bordures fines.');
  assert.equal(fr.shortDescription, '27" OLED 240 Hz');
});

test('Arabic left empty, English page, or no translations at all: the main text', () => {
  assert.equal(withProductText(product, 'ar').description, 'Fast response, thin bezels.');
  assert.equal(withProductText(product, 'en'), product);
  assert.equal(withProductText({ description: 'x', shortDescription: 'y' }, 'ar').description, 'x');
});

test('saved through the same checks on both paths (size limits), and editable', () => {
  const { productSchema, forUpdate } = require(path.join(root, 'backend/dist/validators/schemas.js'));
  const base = { name: 'HP 840', sku: 'HP840', category: 'c', brand: 'b', price: 1, stock: 0 };
  assert.ok(productSchema.safeParse({ ...base, translations: { ar: { shortDescription: 'لابتوب خفيف' } } }).success);
  assert.ok(!productSchema.safeParse({ ...base, translations: { fr: { shortDescription: 'x'.repeat(501) } } }).success);
  assert.ok(forUpdate(productSchema).safeParse({ translations: { fr: { description: '' } } }).success);
  assert.ok(read('backend/src/services/catalog.service.ts').includes("    'translations',\n"), 'saved on edit');
  assert.ok(read('api/v1/admin.js').includes("validated('productSchema'"), 'live site uses the same schema');
});

test('shop lists leave the long translated texts out; search finds the short ones', () => {
  const svc = read('backend/src/services/catalog.service.ts');
  assert.equal(svc.split('-description -translations.fr.description -translations.ar.description').length - 1, 2);
  assert.ok(svc.includes("{ 'translations.ar.shortDescription': rx },"));
});

test('shop pages and the admin form use them', () => {
  assert.ok(read('frontend/src/components/product/ProductCard.tsx').includes('withProductText(product, locale).shortDescription'));
  assert.ok(read('frontend/src/pages/store/ProductDetail.tsx').includes('const p = withProductText(product.data, locale)'));
  assert.ok(read('frontend/src/pages/admin/ProductForm.tsx').includes('translations: form.translations,'));
});

test('Pick your setup: brand in the tab title, a full description in all three languages', () => {
  const page = read('frontend/src/pages/store/Setups.tsx');
  assert.ok(page.includes("${t('setups.metaTitle')} — ${brandName()}"));
  assert.ok(page.includes("${t('setups.metaPromise')}"));
  for (const l of ['en', 'fr', 'ar']) assert.match(read(`frontend/src/i18n/${l}.ts`), /\n {4}metaPromise: '/, l);
});
