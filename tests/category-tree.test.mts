// Shop and admin with sub-categories: main categories on their own (home, chips), the chosen
// one's sub-categories under it, "Components › RAM" in search; French / Arabic names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const load = (p: string) => import(pathToFileURL(path.join(root, 'frontend/src', p)).href);
const tree = await load('lib/categoryTree.ts');
const i18n = await load('i18n/index.ts');
await i18n.loadLocale('fr');
await i18n.loadLocale('ar');

const c = (id: string, slug: string, parent: unknown = null) => ({ _id: id, slug, name: slug, parent, isActive: true, sortOrder: 0 });
const list = [c('1', 'components'), c('2', 'ram', '1'), c('3', 'storage', { _id: '1', name: 'Components', slug: 'components' }), c('4', 'laptops'), c('5', 'orphan', 'gone')];

test('main categories, their sub-categories, and the tree order', () => {
  assert.deepEqual(tree.mainCategories(list).map((x: { slug: string }) => x.slug), ['components', 'laptops', 'orphan']);
  assert.deepEqual(tree.childrenOf(list, '1').map((x: { slug: string }) => x.slug), ['ram', 'storage']);
  assert.equal(tree.mainOf(list, list[1]).slug, 'components');
  assert.equal(tree.mainOf(list, list[0]).slug, 'components');
  assert.deepEqual(
    tree.categoryTree(list).map((x: { category: { slug: string }; depth: number }) => `${x.depth}:${x.category.slug}`),
    ['0:components', '1:ram', '1:storage', '0:laptops', '0:orphan']
  );
});

test('sub-categories in French and Arabic', () => {
  assert.equal(i18n.categoryDisplayName('fr', 'ram', 'RAM'), 'Mémoire RAM');
  assert.equal(i18n.categoryDisplayName('fr', 'graphics-cards', 'Graphics cards'), 'Cartes graphiques');
  assert.equal(i18n.categoryDisplayName('ar', 'storage', 'Storage'), 'التخزين (SSD وHDD)');
});

test('pages: home shows main categories; shop, filters and category page show the sub-categories', () => {
  const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
  assert.match(src('pages/store/Home.tsx'), /const categoryList = mainCategories\(/);
  assert.match(src('pages/store/Shop.tsx'), /subList\.map\(/);
  assert.match(src('components/product/FilterSidebar.tsx'), /childrenOf\(categories, activeMain\._id\)\.map\(/);
  assert.match(src('pages/store/CategoryPage.tsx'), /subs\.map\(/);
  assert.match(src('components/layout/SearchBox.tsx'), / › /);
  const admin = src('components/admin/settings/CategoriesSettings.tsx');
  assert.match(admin, /parent: parent \|\| null/);
  assert.match(admin, /Add suggested categories/);
});

test('admin: each main category has its own "Add sub-category" row, which creates it inside', () => {
  const admin = fs.readFileSync(path.join(root, 'frontend/src/components/admin/settings/CategoriesSettings.tsx'), 'utf8');
  assert.match(admin, /\{endOfGroup && main \? <AddSubRow main=\{main\} onAdded=\{refresh\} \/> : null\}/);
  assert.match(admin, /adminApi\.categories\.create\(\{ name: name\.trim\(\), parent: main\._id \}\)/);
  assert.match(admin, /Add sub-category in \{main\.name\}/);
});

test('category and filter clicks keep the scroll position; changing page still goes back up', () => {
  const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
  const layout = src('app/layouts/StoreLayout.tsx');
  assert.match(layout, /const keepScroll = navigationType !== 'POP' && Boolean\(/);
  assert.match(layout, /if \(location\.hash \|\| keepScroll\) return/);
  assert.match(src('pages/store/Shop.tsx'), /setParams\(next, 'page' in patch \? undefined : \{ state: \{ keepScroll: true \} \}\)/);
  assert.equal((src('pages/store/CategoryPage.tsx').match(/state=\{\{ keepScroll: true \}\}/g) || []).length, 4);
});

test('shop: 3 products per row on tablets and computers (phones keep the 1 / 2 choice)', () => {
  const shop = fs.readFileSync(path.join(root, 'frontend/src/pages/store/Shop.tsx'), 'utf8');
  assert.ok(shop.includes("'md:grid-cols-3 xl:grid-cols-3'"));
  assert.ok(!shop.includes('xl:grid-cols-4'));
});
