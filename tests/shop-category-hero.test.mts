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
  const withAll = { categoryHeroes: { all: a } };
  assert.deepEqual(hero.heroSettingFor(s, 'shop', { slug: 'laptops', main: 'laptops' }), { value: a, from: 'category' });
  assert.deepEqual(hero.heroSettingFor(s, 'shop', { slug: 'gaming-laptops', main: 'laptops' }), { value: a, from: 'main' }, 'sub-category uses its main');
  assert.deepEqual(hero.heroSettingFor(s, 'shop', { slug: 'mini-pcs', main: 'desktop-pc' }), { value: 'none', from: 'main' }, 'photo only, from the main');
  assert.deepEqual(hero.heroSettingFor(s, 'shop', { slug: 'mice', main: 'accessories' }), { value: '', from: 'page' }, 'nothing chosen: picked from the category');
  assert.deepEqual(hero.heroSettingFor(s, 'shop'), { value: '', from: 'page' }, '"All": the old shop pin (a laptop) is not used, the category photos are shown');
  assert.deepEqual(hero.heroSettingFor(withAll, 'shop'), { value: a, from: 'page' }, '"All": a product chosen for All');
  assert.equal(hero.SHOP_ALL, 'all');
  assert.deepEqual(hero.heroSettingFor(s, 'home', { slug: 'laptops' }), { value: '', from: 'page' }, 'only the shop page follows categories');
});

test('the automatic pick in a category: in stock, featured first, then one with a photo', () => {
  const p = (id: string, stock: number, extra: object = {}) => ({ _id: id, stock, images: [], ...extra }) as never;
  assert.equal(hero.pickCategoryHero([p('1', 0, { isFeatured: true }), p('2', 3), p('3', 2, { isFeatured: true })])?._id, '3');
  assert.equal(hero.pickCategoryHero([p('1', 3), p('2', 3, { images: [{ url: 'x' }] })])?._id, '2');
  assert.equal(hero.pickCategoryHero([p('1', 3)])?._id, '1');
  assert.equal(hero.pickCategoryHero([p('1', 0)]), null, 'nothing in stock: the category photo is used');
});

test('an empty category shows its own photo: Cameras a camera, a sub-category its own or its main one', async () => {
  const photo = await import(pathToFileURL(path.join(root, 'frontend/src/lib/categoryPhoto.ts')).href);
  assert.equal(photo.categoryPhoto({ slug: 'camera' }), '/categories/cameras.webp', 'camera = cameras');
  assert.equal(photo.categoryPhoto({ slug: 'security-cameras', parent: 'c1' }), '/categories/sub/security-cameras.webp');
  assert.equal(photo.categoryPhoto({ slug: 'new-sub', parent: 'c1' }, [{ _id: 'c1', slug: 'camera' }]), '/categories/cameras.webp', 'no photo of its own: the main one');
  assert.ok(!String(photo.categoryPhoto({ slug: 'camera' })).includes('laptop'));
});

test('shop "All": one product per main category, computers first, in stock, 6 at most', () => {
  const cats = [
    { _id: 'acc', slug: 'accessories', name: 'Accessories' },
    { _id: 'mice', slug: 'mice', name: 'Mice', parent: 'acc' },
    { _id: 'lap', slug: 'laptops', name: 'Laptops' },
    { _id: 'gp', slug: 'gaming-pcs', name: 'Gaming PCs' },
    { _id: 'mon', slug: 'monitors', name: 'Monitors' },
    { _id: 'desk', slug: 'desktop-pc', name: 'Desktop PC' },
  ] as never[];
  const p = (id: string, cat: string, stock = 3, extra: object = {}) => ({ _id: id, stock, images: [{ url: 'x' }], category: { _id: cat, slug: cat }, ...extra }) as never;
  const out = hero.onePerCategory([p('mouse', 'mice'), p('hp', 'lap'), p('blade', 'lap', 2, { isFeatured: true }), p('pulse', 'gp'), p('screen', 'mon'), p('gone', 'desk', 0)], cats);
  assert.deepEqual(out.map((x: { _id: string }) => x._id), ['blade', 'pulse', 'screen', 'mouse'], 'laptops, gaming PCs, monitors, then accessories (a mouse counts for Accessories); sold out skipped; featured first');
  assert.equal(hero.ALL_ROTATE_MAX, 6);
});
