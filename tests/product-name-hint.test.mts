// Admin product form: tip when a product name is too short / only the brand / too long for Google.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const { productNameHint } = await import(pathToFileURL(path.join(root, 'frontend/src/lib/productNameHint.ts')).href);

test('"HP" with brand HP is only the brand', () => {
  assert.equal(productNameHint('HP', 'HP'), 'brand_only');
  assert.equal(productNameHint(' hp ', 'HP'), 'brand_only');
});

test('short names get a tip; a full model name does not', () => {
  assert.equal(productNameHint('Hp elite book'), 'too_short');
  assert.equal(productNameHint('Laptop'), 'too_short');
  assert.equal(productNameHint('HP EliteBook 840 G8 i7 16GB 512GB'), null);
  assert.equal(productNameHint(''), null);
  // accessories with a clear 4-word name are fine without a number
  assert.equal(productNameHint('Brynoxa Desk Cable Kit'), null);
});

test('very long names get a tip (Google cuts them)', () => {
  assert.equal(productNameHint('A'.repeat(20) + ' ' + 'B'.repeat(30) + ' ' + 'C'.repeat(25)), 'too_long');
});
