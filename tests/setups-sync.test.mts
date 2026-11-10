import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const shop = await import(pathToFileURL(path.join(root, 'frontend/src/lib/setups.ts')).href);
const server = await import(pathToFileURL(path.join(root, 'backend/src/utils/setups.ts')).href);

test('setups: shop and server lists are the same', () => {
  assert.deepEqual([...shop.SETUP_IDS], [...server.SETUP_IDS]);
  assert.deepEqual(shop.SETUP_CATEGORIES, server.SETUP_CATEGORIES);
});

test('setups: each kind of product has its own group, in a set order per setup', () => {
  assert.equal(shop.setupPieceOf('gaming-pcs'), 'pc');
  assert.equal(shop.setupPieceOf('desktop-pc'), 'pc');
  assert.equal(shop.setupPieceOf('laptops'), 'laptop');
  assert.equal(shop.setupPieceOf('monitors'), 'screen');
  assert.equal(shop.setupPieceOf('mice'), 'mouse');
  assert.equal(shop.setupPieceOf('keyboards'), 'keyboard');
  assert.equal(shop.setupPieceOf('headphones'), 'headset');
  assert.equal(shop.setupPieceOf('webcams'), 'webcam');
  assert.equal(shop.setupPieceOf('components'), 'components');
  assert.equal(shop.setupPieceOf('laptop-stands'), 'accessories');
  assert.equal(shop.setupPieceOf(undefined), 'accessories');
  for (const id of shop.SETUP_IDS) assert.deepEqual([...shop.SETUP_PIECES[id]].sort(), [...shop.SETUP_PIECE_IDS].sort(), id);
  assert.equal(shop.SETUP_PIECES.gaming[0], 'pc', 'gaming starts with the PCs');
  assert.equal(shop.SETUP_PIECES.study[0], 'laptop', 'study starts with the laptops');
});

const p = (category: string, name: string, use?: string, setups?: string[]) => ({ name, category: { slug: category }, specs: use ? { Use: use } : {}, setups });
const on = (x: object) => shop.setupsFor(x);

test('setups: in shared categories the product words decide (gaming mouse in gaming, not study)', () => {
  assert.deepEqual(on(p('mice', 'Logitech Aero Pro Wireless', 'Competitive gaming')), ['gaming']);
  assert.deepEqual(on(p('mice', 'Razer Basilisk V3', 'MMO & desktop')), ['gaming']);
  assert.deepEqual(on(p('headphones', 'Logitech Zone Vibe 100', 'Calls & music')), ['study', 'work']);
  assert.deepEqual(on(p('headphones', 'Razer Nova Surround Headset', 'Games & voice')), ['gaming']);
  assert.deepEqual(on(p('monitors', 'Samsung Odyssey OLED G6', 'Gaming & media')), ['gaming', 'creator']);
  assert.deepEqual(on(p('laptops', 'HP', 'study , programing')), ['study', 'work']);
  assert.deepEqual(on(p('laptops', 'Hp elite book')), ['study', 'work']);
  assert.deepEqual(on(p('laptops', 'Blade 15', 'Creators & work')), ['work', 'creator']);
  assert.deepEqual(on(p('laptops', 'HP')), ['study', 'work'], 'no telling words: study and work, never gaming');
  assert.deepEqual(on(p('mice', 'Basic mouse')), ['gaming', 'study', 'work'], 'no telling words: everywhere it fits');
  assert.deepEqual(on(p('accessories', 'Desk Cable Kit', 'Cables')), ['study', 'work']);
  assert.deepEqual(on(p('mice', 'Souris gamer RGB')), ['gaming'], 'French words');
  assert.deepEqual(on(p('laptops', 'حاسوب للدراسة')), ['study'], 'Arabic words');
  assert.deepEqual(on(p('hubs-docks', 'Network switch')), ['study', 'work', 'creator'].filter((s) => shop.NEUTRAL_CATEGORIES[s].includes('hubs-docks')), '"network" is not "work"');
});

test('setups: categories only one kind of setup uses go by category; admin ticks win', () => {
  assert.deepEqual(on(p('gaming-pcs', 'Pulse 1440', '1440p gaming')), ['gaming', 'creator']);
  assert.deepEqual(on(p('components', 'RTX 4080', 'GPU upgrade')), ['gaming', 'creator']);
  assert.deepEqual(on(p('mice', 'Logitech Aero Pro Wireless', 'Competitive gaming', ['study'])), ['study'], 'ticked in admin');
  assert.deepEqual(on(p('unknown-category', 'X')), []);
});
