// Admin → Settings keeps only its own settings (General, Catalog, Customers & pricing,
// Notifications). Tabs that only repeated another page are gone; their old links open that page.
// Inventory settings live in Inventory → Settings.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_helpers.cjs');
const read = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');

test('Settings: four sections of its own, no repeated pages', () => {
  const s = read('pages/admin/Settings.tsx');
  assert.ok(s.includes("type SectionId = 'general' | 'catalog' | 'customers' | 'notifications'"));
  for (const gone of ["label: 'Orders & payments'", "label: 'Storefront'", "label: 'Inventory'", "label: 'Security'", 'HomeDealsSettings', 'InventorySettings']) {
    assert.ok(!s.includes(gone), gone);
  }
});

test('old Settings links open the page where things really are', () => {
  const s = read('pages/admin/Settings.tsx');
  for (const pair of [
    "orders: '/admin/orders?view=deposits'",
    "storefront: '/admin/products?board=home'",
    "inventory: '/admin/inventory/settings'",
    "security: '/admin/security'",
  ]) assert.ok(s.includes(pair), pair);
  assert.ok(s.includes('if (moved) return <Navigate to={moved} replace />'));
  // nothing in the admin still points at a removed tab
  const files = ['lib/adminSearch.ts', 'pages/admin/ProductForm.tsx'];
  for (const f of files) assert.ok(!/settings\?tab=(orders|storefront|inventory|security)/.test(read(f)), f);
});

test('Inventory → Settings: a tab of the Inventory page, for staff allowed to change settings', () => {
  const nav = read('components/admin/inventory/InventoryNav.tsx');
  assert.ok(nav.includes("{ to: '/admin/inventory/settings', label: 'Settings' },"));
  assert.ok(nav.includes('const tabs = TABS.filter((tab) => canOpenAdminPath(role, tab.to))'));
  assert.ok(read('lib/permissions.ts').includes("'/admin/inventory/settings': 'settings',"));
  assert.ok(read('app/router.tsx').includes('<Route path="inventory/settings" element={<S><AdminInventorySettings /></S>} />'));
  assert.ok(read('pages/admin/InventorySettingsPage.tsx').includes('<InventorySettings settings={settings.data} />'));
});
