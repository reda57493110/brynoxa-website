// Category names in the visitor's language: French / Arabic pages showed every category in
// English. Now by address (slug), including the new "Desktop PCs" (HP EliteDesk…) = "Unités
// centrales". English shows the name set in Admin → Categories (the owner's wording wins).
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
