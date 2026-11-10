import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const hero = await import(pathToFileURL(path.join(root, 'frontend/src/lib/heroProduct.ts')).href);
const a = 'a'.repeat(24);
const b = 'b'.repeat(24);

test('which header setting applies: the category, else its main category, else the shop', () => {
  const s = { pageHeroProducts: { shop: b }, categoryHeroes: { laptops: a, 'desktop-pc': 'none' } };
  assert.deepEqual(hero.heroSettingFor(s, 'shop', { slug: 'laptops', main: 'laptops' }), { value: a, from: 'category' });
  assert.deepEqual(hero.heroSettingFor(s, 'shop', { slug: 'gaming-laptops', main: 'laptops' }), { value: a, from: 'main' }, 'sub-category uses its main');
  assert.deepEqual(hero.heroSettingFor(s, 'shop', { slug: 'mini-pcs', main: 'desktop-pc' }), { value: 'none', from: 'main' }, 'photo only, from the main');
  assert.deepEqual(hero.heroSettingFor(s, 'shop', { slug: 'mice', main: 'accessories' }), { value: b, from: 'page' }, 'nothing chosen: the shop (the hook then picks from the category first)');
  assert.deepEqual(hero.heroSettingFor(s, 'shop'), { value: b, from: 'page' }, 'no category');
  assert.deepEqual(hero.heroSettingFor(s, 'home', { slug: 'laptops' }), { value: '', from: 'page' }, 'only the shop page follows categories');
});

test('the automatic pick in a category: in stock, featured first, then one with a photo', () => {
  const p = (id: string, stock: number, extra: object = {}) => ({ _id: id, stock, images: [], ...extra }) as never;
  assert.equal(hero.pickCategoryHero([p('1', 0, { isFeatured: true }), p('2', 3), p('3', 2, { isFeatured: true })])?._id, '3');
  assert.equal(hero.pickCategoryHero([p('1', 3), p('2', 3, { images: [{ url: 'x' }] })])?._id, '2');
  assert.equal(hero.pickCategoryHero([p('1', 3)])?._id, '1');
  assert.equal(hero.pickCategoryHero([p('1', 0)]), null, 'nothing in stock: the shop header is used');
});
