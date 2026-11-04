// Category names in the visitor's language: French / Arabic pages showed every category in
// English. Now by address (slug), including the new "Desktop PCs" (HP EliteDesk…) = "Unités
// centrales". English shows the name set in Admin → Categories (the owner's wording wins).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const load = (p: string) => import(pathToFileURL(path.join(root, 'frontend/src', p)).href);
const i18n = await load('i18n/index.ts');
const icons = await load('lib/categoryIcon.ts');
// French and Arabic load on demand in the app
await i18n.loadLocale('fr');
await i18n.loadLocale('ar');

test('Desktop PCs: "Unités centrales" in French, Arabic name, the admin name in English', () => {
  assert.equal(i18n.categoryDisplayName('fr', 'desktop-pcs', 'Desktop PCs'), 'Unités centrales');
  assert.equal(i18n.categoryDisplayName('ar', 'desktop-pcs', 'Desktop PCs'), 'وحدات مركزية');
  assert.equal(i18n.categoryDisplayName('en', 'desktop-pcs', 'Desktop PCs'), 'Desktop PCs');
  assert.match(i18n.categoryDisplayDescription('fr', 'desktop-pcs', ''), /HP EliteDesk/);
  assert.equal(icons.categoryIcon('desktop-pcs', 'Desktop PCs'), 'cpu');
});

test('the existing categories are translated too; English keeps what the owner typed', () => {
  assert.equal(i18n.categoryDisplayName('fr', 'laptops', 'Laptops'), 'Ordinateurs portables');
  assert.equal(i18n.categoryDisplayName('ar', 'monitors', 'Monitors'), 'شاشات');
  assert.equal(i18n.categoryDisplayName('en', 'laptops', 'Notebooks'), 'Notebooks', 'renamed in admin');
  assert.equal(i18n.categoryDisplayName('fr', 'my-new-thing', 'My new thing'), 'My new thing', 'no translation yet: admin name');
  assert.equal(i18n.categoryDisplayDescription('en', 'mice', 'My words'), 'My words');
});

test('all three languages have the same categories', async () => {
  const [{ en }, { fr }, { ar }] = await Promise.all([load('i18n/en.ts'), load('i18n/fr.ts'), load('i18n/ar.ts')]);
  const keys = (m: { catalog: { categories: object } }) => Object.keys(m.catalog.categories).sort().join(',');
  assert.equal(keys(fr), keys(en));
  assert.equal(keys(ar), keys(en));
  assert.ok(keys(en).includes('desktop-pcs'));
});

test('addresses typed differently ("camera", "desktop-pc") get the names and the built-in photos', async () => {
  const photos = await load('lib/categoryPhoto.ts');
  assert.equal(i18n.categoryDisplayName('fr', 'camera', 'camera'), 'Caméras');
  assert.equal(i18n.categoryDisplayName('fr', 'desktop-pc', 'Desktop PC'), 'Unités centrales');
  assert.equal(i18n.categoryDisplayName('en', 'desktop-pc', 'Desktop PC'), 'Desktop PC', 'English: the admin name');
  assert.equal(photos.categoryPhoto({ slug: 'camera' }), '/categories/cameras.webp');
  assert.equal(photos.categoryPhoto({ slug: 'desktop-pc' }), '/categories/desktop-pcs-v4.webp');
  assert.ok(photos.categoryPhotoSrcSet({ slug: 'camera' }).includes('/categories/cameras-480.webp 480w, /categories/cameras-960.webp 960w'));
  assert.equal(photos.categoryPhoto({ slug: 'camera', image: 'https://x/y.jpg' }), 'https://x/y.jpg', 'a photo set in admin wins');
  for (const f of ['cameras.webp', 'cameras-480.webp', 'cameras-960.webp', 'desktop-pcs-v4.webp', 'desktop-pcs-v4-480.webp', 'desktop-pcs-v4-960.webp']) {
    const size = fs.statSync(path.join(root, 'frontend/public/categories', f)).size;
    assert.ok(size > 2000 && size < 200_000, f + ': ' + size);
  }
});

test('the built-in Unsplash photos need no credit line; a photo set in admin needs none either', async () => {
  const photos = await load('lib/categoryPhoto.ts');
  assert.equal(photos.categoryPhotoCredit({ slug: 'desktop-pc' }), undefined);
  assert.equal(photos.categoryPhotoCredit({ slug: 'cameras' }), undefined);
  assert.ok(fs.readFileSync(path.join(root, 'frontend/src/pages/store/Home.tsx'), 'utf8').includes('categoryPhotoCredit(c)'), 'credits still shown when a future photo needs one');
});

test('the Desktop PCs photo is sharp on phones: a 1600 px copy is offered', async () => {
  const photos = await load('lib/categoryPhoto.ts');
  assert.ok(photos.categoryPhotoSrcSet({ slug: 'desktop-pc' }).endsWith('/categories/desktop-pcs-v4.webp 1600w'));
  assert.ok(!photos.categoryPhotoSrcSet({ slug: 'laptops' }).includes('1600w'), 'others unchanged');
});
