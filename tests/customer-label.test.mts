// Customers added by staff show where they came from: "Ahmed / Guest TikTok", or "Guest TikTok"
// without a name. Shop and server use the same labels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const shop = await import(pathToFileURL(path.join(root, 'frontend/src/lib/orderOrigin.ts')).href);
const server = createRequire(import.meta.url)(path.join(root, 'backend/dist/utils/orderOrigin.js'));

test('name / guest source; website customers keep their plain name', () => {
  assert.equal(shop.customerLabel({ name: 'Ahmed', source: 'tiktok' }), 'Ahmed / Guest TikTok');
  assert.equal(shop.customerLabel({ name: 'Guest TikTok', source: 'tiktok' }), 'Guest TikTok');
  assert.equal(shop.customerLabel({ name: 'Sara', source: 'store' }), 'Sara / Guest Shop');
  assert.equal(shop.customerLabel({ name: 'Karim' }), 'Karim');
  assert.equal(shop.customerLabel({ name: 'Karim', source: 'website' }), 'Karim');
});

test('shop and server lists and labels are the same', () => {
  assert.deepEqual([...shop.ORDER_ORIGINS], [...server.ORDER_ORIGINS]);
  for (const o of shop.MANUAL_ORDER_ORIGINS) assert.equal(shop.guestLabel(o), server.guestLabel(o));
  assert.deepEqual(server.customerSourceFilter('website'), { source: { $in: ['website', null] } });
  assert.deepEqual(server.customerSourceFilter('tiktok'), { source: 'tiktok' });
});
