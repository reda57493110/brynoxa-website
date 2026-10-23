// Language in the address: /shop (English), /fr/shop, /ar/shop.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const lp = await import(pathToFileURL(path.join(root, 'frontend/src/lib/localePath.ts')).href);

test('the prefix tells the language', () => {
  assert.equal(lp.localeFromPath('/fr/shop'), 'fr');
  assert.equal(lp.localeFromPath('/ar'), 'ar');
  assert.equal(lp.localeFromPath('/shop'), null);
  assert.equal(lp.localeFromPath('/france-laptop'), null, 'only a whole first segment counts');
});

test('stripping and adding the prefix', () => {
  assert.equal(lp.stripLocale('/fr/product/hp-840'), '/product/hp-840');
  assert.equal(lp.stripLocale('/ar'), '/');
  assert.equal(lp.stripLocale('/shop'), '/shop');
  assert.equal(lp.localizedPath('/shop', 'fr'), '/fr/shop');
  assert.equal(lp.localizedPath('/', 'ar'), '/ar');
  assert.equal(lp.localizedPath('/fr/shop', 'en'), '/shop');
  assert.equal(lp.localizedPath('/ar/contact', 'fr'), '/fr/contact');
});
