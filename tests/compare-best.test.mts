// Compare page: the "best" highlight per row and the overall pick.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const best = await import(pathToFileURL(path.join(root, 'frontend/src/lib/compareBest.ts')).href);

test('more RAM wins; lower response time wins; ties all win', () => {
  assert.deepEqual(best.bestIndexes([8, 16, 16], false), [1, 2]);
  assert.deepEqual(best.bestIndexes([5, 1, 4], true), [1]);
});

test('no highlight when everyone is equal or only one product has the spec', () => {
  assert.deepEqual(best.bestIndexes([16, 16], false), []);
  assert.deepEqual(best.bestIndexes([16, null], false), []);
});

test('storage text is compared by size ("1 TB" beats "512 GB")', () => {
  assert.equal(best.rankValue('storage', '1 TB', false), 1024);
  assert.equal(best.rankValue('storage', '1 TB + 512 GB', false), 1536);
  assert.equal(best.rankValue('storage', 'SSD', false), null);
});

test('neutral specs are never ranked; text specs are not ranked', () => {
  assert.equal(best.rankValue('voltage', '1.35', true), null);
  assert.equal(best.rankValue('cpu', 'Intel Core i7', false), null);
});

test('overall pick: the product with the most wins, none on a tie', () => {
  assert.equal(best.overallPick([3, 1, 0]), 0);
  assert.equal(best.overallPick([2, 2]), null);
  assert.equal(best.overallPick([0, 0]), null);
  assert.equal(best.overallPick([4]), null);
});
