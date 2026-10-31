// Admin search (top bar, Ctrl / ⌘ + K or "/"): pages and settings by everyday words, orders,
// customers, products, coupons, inbox and staff — each group only for staff who can open it;
// a phone number finds the saved one however it was written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const load = (p: string) => import(pathToFileURL(path.join(root, p)).href);
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');

test('pages and settings are found by the words people type', async () => {
  const { matchPages, ADMIN_PAGES } = await load('frontend/src/lib/adminSearch.ts');
  const first = (q: string) => matchPages(q)[0]?.to;
  assert.equal(first('profit'), '/admin/profit');
  assert.equal(first('delivery fee'), '/admin/settings?tab=orders');
  assert.equal(first('wafacash'), '/admin/orders?view=deposits');
  assert.equal(first('retour'), '/admin/inventory/returns');
  assert.equal(first('instagram'), '/admin/orders/new');
  assert.equal(first('mot de passe'), undefined, 'every word must match');
  assert.equal(first('password'), '/admin/security');
  assert.deepEqual(matchPages(''), []);
  // Every page in the list exists in the admin router
  const router = src('app/router.tsx');
  for (const p of ADMIN_PAGES) {
    const sub = p.to.split(/[?#]/)[0].replace(/^\/admin\/?/, '');
    if (sub) assert.match(router, new RegExp(`path="${sub.replace(/\//g, '\/')}"`), p.to);
  }
});

test('a phone number finds the saved one however it was written', async () => {
  const { phoneSearchRegex } = await load('backend/src/utils/phoneSearch.ts');
  const rx = phoneSearchRegex('0612345678');
  for (const saved of ['06 12 34 56 78', '+212 6 12-34-56-78', '0612.34.56.78', '+212612345678']) assert.ok(rx.test(saved), saved);
  assert.ok(!rx.test('06 12 34 56 79'));
  assert.ok(phoneSearchRegex('+212 6 12 34 56 78').test('0612345678'));
  assert.equal(phoneSearchRegex('Karim'), null, 'names stay a normal search');
  assert.equal(phoneSearchRegex('2026'), null, 'too short to be a phone');
  assert.match(fs.readFileSync(path.join(root, 'backend/src/services/order.service.ts'), 'utf8'), /'shippingAddress\.phone': phoneSearchRegex\(q\) \?\? rx/);
  assert.match(fs.readFileSync(path.join(root, 'backend/src/services/customerAnalytics.service.ts'), 'utf8'), /phone: phoneSearchRegex\(q\) \?\? rx/);
});

test('one search in the top bar; each group only for staff who can open it', () => {
  assert.equal((src('components/layout/AdminTopbar.tsx').match(/<AdminSearch \/>/g) || []).length, 1, 'one window per Ctrl K');
  const search = src('components/admin/AdminSearch.tsx');
  for (const [group, page] of [['orders', '/admin/orders'], ['customers', '/admin/customers'], ['products', '/admin/products'], ['staff', '/admin/roles'], ['coupons', '/admin/coupons'], ['messages', '/admin/messages']]) {
    const exact = `enabled: ready && can('${page}')`.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    assert.match(search, new RegExp(exact), group);
  }
  assert.match(search, /\.filter\(\(p\) => can\(p\.to\)\)/, 'pages too');
  assert.match(search, /\(e\.key === 'k' \|\| e\.key === 'K'\) && \(e\.ctrlKey \|\| e\.metaKey\)/);
});
