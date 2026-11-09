import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const rows = await import(pathToFileURL(path.join(root, 'frontend/src/lib/homeRows.ts')).href);

test('Deals facts come from the real prices; New arrivals from the real dates', () => {
  const p = (price: number, compareAtPrice?: number, createdAt?: string) => ({ _id: String(price), price, compareAtPrice, createdAt }) as never;
  assert.equal(rows.bestDiscount([p(4000, 5500), p(950, 1000), p(300)]), 27, '4000 instead of 5500 = 27% off');
  assert.equal(rows.bestDiscount([p(300), p(400, 300)]), 0, 'no real discount');
  assert.equal(rows.latestAdded([p(1, undefined, '2026-11-01T10:00:00Z'), p(2, undefined, '2026-11-07T09:00:00Z'), p(3)])?.toISOString(), '2026-11-07T09:00:00.000Z');
  assert.equal(rows.latestAdded([p(1)]), null);
});
