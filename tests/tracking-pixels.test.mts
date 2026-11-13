// The shop tells Meta / TikTok about visits, products, carts, checkouts and orders — never on admin
// pages or on addresses carrying a private key.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');

// A tiny fake browser: the loaders only need document.head, location and window
const added: string[] = [];
const loc = { pathname: '/shop', search: '', origin: 'https://shop.test' };
const g = globalThis as Record<string, unknown>;
g.window = g;
g.location = loc;
Object.defineProperty(g, 'document', {
  value: { title: 'Shop', head: { appendChild: (s: { src: string }) => added.push(s.src) }, createElement: () => ({}) },
  configurable: true,
});
(g.window as { location: unknown }).location = loc;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
const events: string[] = [];
g.dispatchEvent = (e: { type: string }) => { events.push(e.type); return true };
g.CustomEvent = class { type: string; detail: unknown; constructor(type: string, o?: { detail?: unknown }) { this.type = type; this.detail = o?.detail } };

const a = await import(pathToFileURL(path.join(root, 'frontend/src/lib/analytics.ts')).href);
const consent = await import(pathToFileURL(path.join(root, 'frontend/src/lib/consent.ts')).href);

test('nothing loads before the visitor accepts; Accept starts what the shop configured', () => {
  const ids = { metaPixelId: '1234567890123456', tiktokPixelId: 'CABCD1234EFGH5678IJK' };
  assert.equal(a.trackingWanted(ids), true, 'the banner is shown');
  assert.equal(a.trackingWanted({}), false, 'no pixel set: no banner');
  a.configureTracking(ids);
  a.trackViewItem({ item_id: 'p0', item_name: 'x', price: 1 });
  assert.deepEqual(added, [], 'no consent yet: no script');
  consent.saveConsent('denied');
  a.configureTracking(ids);
  assert.deepEqual(added, [], 'refused: no script');
  assert.equal(consent.readConsent(), 'denied');
  consent.saveConsent('granted');
  a.applyConsent();
  assert.equal(added.length, 2, 'accepted: Meta and TikTok load');
  assert.ok(events.includes('brx-consent-change'));
});


test('never on admin pages or addresses with a private key', () => {
  assert.equal(a.pixelsAllowedOn('/shop?category=laptops'), true);
  assert.equal(a.pixelsAllowedOn('/products/rtx-4060?utm_source=facebook'), true);
  assert.equal(a.pixelsAllowedOn('/admin/orders'), false);
  assert.equal(a.pixelsAllowedOn('/admin-print/slips'), false);
  assert.equal(a.pixelsAllowedOn('/reset-password?token=abc'), false);
  assert.equal(a.pixelsAllowedOn('/order-confirmation/BRX-1?receipt=xyz'), false);
});

test('only well-formed ids are used', () => {
  assert.deepEqual(a.cleanTrackingIds({ metaPixelId: '1234567890123456', tiktokPixelId: 'cabcd1234efgh5678ijk', gaMeasurementId: 'oops' }), {
    meta: '1234567890123456',
    tiktok: 'CABCD1234EFGH5678IJK',
    ga: '',
  });
});

test('loads the official scripts once, then sends the shop events in their names', () => {
  a.configureTracking({ metaPixelId: '1234567890123456', tiktokPixelId: 'CABCD1234EFGH5678IJK' });
  assert.deepEqual(added, ['https://connect.facebook.net/en_US/fbevents.js', 'https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=CABCD1234EFGH5678IJK&lib=ttq'], 'once each');
  const w = g as unknown as { fbq: { queue: unknown[][]; disablePushState: boolean }; ttq: unknown[][] };
  assert.equal(w.fbq.disablePushState, true, 'page changes come from the shop only');
  assert.deepEqual(w.fbq.queue.slice(0, 3), [['set', 'autoConfig', false, '1234567890123456'], ['init', '1234567890123456'], ['track', 'PageView']]);

  a.trackViewItem({ item_id: 'p1', item_name: 'RTX laptop', price: 9000 });
  a.trackPurchase({ transactionId: 'BRX-20261113-0001', value: 9035, items: [{ item_id: 'p1', item_name: 'RTX laptop', price: 9000, quantity: 1 }] });
  const fbq = w.fbq.queue.map((c) => c.slice(0, 2).join(' '));
  assert.ok(fbq.includes('track ViewContent'));
  const purchase = w.fbq.queue.find((c) => c[1] === 'Purchase')!;
  assert.equal((purchase[2] as { value: number; currency: string }).value, 9035);
  assert.equal((purchase[2] as { currency: string }).currency, 'MAD');
  assert.deepEqual(purchase[3], { eventID: 'BRX-20261113-0001' }, 'the order number avoids counting it twice');
  const order = w.ttq.find((c) => c[0] === 'track' && c[1] === 'PlaceAnOrder')!;
  assert.deepEqual(order[3], { event_id: 'BRX-20261113-0001' });

  // the same page is not counted twice; a new page is; a private page is never sent
  const views = () => w.fbq.queue.filter((c) => c[1] === 'PageView').length;
  a.trackPageView('/shop');
  assert.equal(views(), 1);
  loc.pathname = '/products/x';
  a.trackPageView('/products/x');
  assert.equal(views(), 2);
  loc.pathname = '/reset-password';
  loc.search = '?token=secret';
  a.trackPageView('/reset-password?token=secret');
  a.trackSearch('laptop');
  assert.equal(views(), 2);
  assert.ok(!w.fbq.queue.some((c) => c[1] === 'Search'), 'nothing at all on a private page');
});
