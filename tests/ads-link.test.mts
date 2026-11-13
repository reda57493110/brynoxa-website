// The shop side of Ads & social media: a visit through a campaign's tracking link is remembered
// for 30 days (the latest link wins) and sent with the order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const { captureUtm, readUtm, utmFromSearch, trackingLink, roasLabel } = await import(
  pathToFileURL(path.join(root, 'frontend/src/lib/adTracking.ts')).href
);

const DAY = 86_400_000;

test('a tracking link is remembered, cleaned, and kept 30 days', () => {
  store.clear();
  const t0 = Date.UTC(2026, 10, 1);
  captureUtm('?utm_source=Facebook&utm_medium=paid&utm_campaign=Gaming%20PCs&fbclid=xyz', t0);
  assert.deepEqual(readUtm(t0 + DAY), { source: 'facebook', medium: 'paid', campaign: 'gaming-pcs' });
  assert.deepEqual(readUtm(t0 + 29 * DAY)?.campaign, 'gaming-pcs');
  assert.equal(readUtm(t0 + 31 * DAY), undefined, 'too old: not counted');
  assert.equal(store.size, 0, 'and forgotten');
});

test('the latest link wins; pages without utm change nothing', () => {
  store.clear();
  const t0 = Date.UTC(2026, 10, 1);
  captureUtm('?utm_source=tiktok&utm_campaign=video-1', t0);
  captureUtm('?q=laptop', t0 + DAY);
  assert.equal(readUtm(t0 + DAY)?.campaign, 'video-1');
  captureUtm('?utm_source=instagram&utm_campaign=reel-2', t0 + 2 * DAY);
  assert.deepEqual(readUtm(t0 + 2 * DAY), { source: 'instagram', campaign: 'reel-2' });
  assert.equal(utmFromSearch('?utm_medium=paid'), null, 'a medium alone is not a link');
});

test('broken saved data never breaks the checkout', () => {
  store.clear();
  store.set('brx-utm', '{not json');
  assert.equal(readUtm(), undefined);
  store.set('brx-utm', JSON.stringify({ source: '<b>', at: 'yesterday' }));
  assert.equal(readUtm(), undefined);
});

test('the link to paste in an ad; return per 1 DH', () => {
  assert.equal(trackingLink('https://shop.test/', '/products/rtx', 'utm_source=facebook&utm_medium=paid&utm_campaign=x'), 'https://shop.test/products/rtx?utm_source=facebook&utm_medium=paid&utm_campaign=x');
  assert.equal(trackingLink('https://shop.test', '/shop?category=laptops', 'utm_source=google'), 'https://shop.test/shop?category=laptops&utm_source=google');
  assert.equal(trackingLink('https://shop.test', 'evil', 'utm_source=google'), 'https://shop.test/?utm_source=google');
  assert.equal(roasLabel(null), '—');
  assert.equal(roasLabel(4.25), '4.3 DH');
  assert.equal(roasLabel(12), '12 DH');
});
