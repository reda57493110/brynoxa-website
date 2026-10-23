// Product page title + description for Google, in the page language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const { productSeoText, priceText } = await import(pathToFileURL(path.join(root, 'frontend/src/lib/productSeo.ts')).href);

test('title: model + specs the name lacks + price in Morocco', () => {
  const { title } = productSeoText({ name: 'HP EliteBook 840 G8', price: 4000, specs: ['Intel Core i7', '16 GB', '256 GB'], locale: 'fr' });
  assert.equal(title, 'HP EliteBook 840 G8 Intel Core i7 16 GB — Prix au Maroc | Brynoxa');
});

test('title does not repeat specs already in the name, and stays short', () => {
  const { title } = productSeoText({ name: 'ASUS TUF A15 Ryzen 7 16 GB', price: 9490, specs: ['16 GB', 'RTX 4050'], locale: 'en' });
  assert.ok(!/16 GB.*16 GB/.test(title));
  const long = productSeoText({ name: 'A very long product name that already uses most of the space we have', price: 100, specs: ['16 GB'] });
  assert.ok(long.title.length <= 65, long.title);
});

test('description: price in DH, specs, promises; at most 158 characters', () => {
  const { description } = productSeoText({ name: 'HP EliteBook 840 G8', price: 4000, specs: ['Intel Core i7', '16 GB'], shortDescription: 'Light business laptop.', locale: 'en' });
  assert.match(description, /^HP EliteBook 840 G8 at 4 000 DH in Morocco\. Intel Core i7, 16 GB\. Cash on delivery/);
  assert.ok(description.length <= 158);
  assert.equal(priceText(24990), '24 990 DH');
});

test('Arabic copy', () => {
  const { title, description } = productSeoText({ name: 'HP EliteBook', price: 4000, locale: 'ar' });
  assert.match(title, /الثمن في المغرب/);
  assert.match(description, /الدفع عند الاستلام/);
});
