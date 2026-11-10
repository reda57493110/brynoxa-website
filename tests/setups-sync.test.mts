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

test('setups: each category goes to one part of the page; every setup shows every part once', () => {
  assert.equal(shop.setupPieceOf('gaming-pcs'), 'computer');
  assert.equal(shop.setupPieceOf('laptops'), 'computer');
  assert.equal(shop.setupPieceOf('monitors'), 'screen');
  assert.equal(shop.setupPieceOf('mice'), 'gear');
  assert.equal(shop.setupPieceOf('headphones'), 'gear');
  assert.equal(shop.setupPieceOf('components'), 'components');
  assert.equal(shop.setupPieceOf('webcams'), 'cameras');
  assert.equal(shop.setupPieceOf('laptop-stands'), 'accessories');
  assert.equal(shop.setupPieceOf(undefined), 'accessories');
  const all = ['computer', 'screen', 'gear', 'components', 'cameras', 'accessories'];
  for (const id of shop.SETUP_IDS) assert.deepEqual([...shop.SETUP_PIECES[id]].sort(), [...all].sort(), id);
  // Laptops show for study and work, gaming PCs for gaming (not study)
  assert.ok(shop.SETUP_CATEGORIES.study.includes('laptops') && shop.SETUP_CATEGORIES.work.includes('laptops'));
  assert.ok(shop.SETUP_CATEGORIES.gaming.includes('gaming-pcs') && !shop.SETUP_CATEGORIES.study.includes('gaming-pcs'));
});
