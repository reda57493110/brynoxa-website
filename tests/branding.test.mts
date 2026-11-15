// The shop shows the saved store identity: name in every text, logo, slogan per language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const load = async (rel: string) => import(pathToFileURL(path.join(root, 'frontend/src', rel)).href);
const brand = await load('lib/brand.ts');
const { translate } = await load('i18n/index.ts');

test('built-in identity until the owner saves one', () => {
  const b = brand.brandFrom(null);
  assert.equal(b.name, 'Brynoxa');
  assert.equal(b.logo, '/brand/brynoxa-mark-128.webp');
  assert.equal(brand.withBrand('Welcome to Brynoxa'), 'Welcome to Brynoxa');
});

test('a new name shows in every interface text, in all languages', () => {
  const before = translate('en', 'meta.homeTitle');
  assert.match(before, /Brynoxa/);
  brand.applyBrand({ storeName: 'TechZone', branding: { logo: '/api/v1/images/' + 'c'.repeat(24), tagline: { fr: 'PC livrés partout' } } });
  try {
    assert.equal(brand.brandName(), 'TechZone');
    assert.ok(translate('en', 'meta.homeTitle').includes('TechZone') && !translate('en', 'meta.homeTitle').includes('Brynoxa'));
    assert.ok(translate('ar', 'meta.homeTitle').includes('TechZone'));
    assert.equal(brand.BRAND.logo, '/api/v1/images/' + 'c'.repeat(24));
    assert.equal(brand.brandTagline('fr'), 'PC livrés partout');
    assert.equal(brand.brandTagline('en'), '', 'empty = the built-in slogan');
  } finally {
    brand.applyBrand(null);
  }
  assert.match(translate('en', 'meta.homeTitle'), /Brynoxa/);
});

test('a logo from another site is never shown', () => {
  assert.equal(brand.brandFrom({ branding: { logo: 'https://evil.test/x.png' } }).logo, '/brand/brynoxa-mark-128.webp');
  assert.equal(brand.brandFrom({ storeName: '   ' }).name, 'Brynoxa', 'empty name = built-in');
});
