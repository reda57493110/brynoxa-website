// Second scan (texts and buttons):
// B  shop: product detail values in French / Arabic, no English "COD" in French, the right message
//    after removing from compare, translated screen-reader labels;
// C  admin: buttons and links only for staff the server accepts them from;
// D  admin: no leftovers of the removed reviews, plain wording, labels instead of raw codes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
const specs = await import(pathToFileURL(path.join(root, 'frontend/src/lib/specs.ts')).href);
const i18n = await import(pathToFileURL(path.join(root, 'frontend/src/i18n/index.ts')).href);
await i18n.loadLocale('fr');
await i18n.loadLocale('ar');

test('B: product detail values are shown in French and Arabic; model names stay as typed', () => {
  assert.equal(specs.formatSpecValue('warranty', '1 year', 'fr'), '1 an');
  assert.equal(specs.formatSpecValue('microphone', 'Built-in', 'ar'), 'مدمج');
  assert.equal(specs.formatSpecValue('color', 'Silver', 'fr'), 'Argent');
  assert.equal(specs.formatSpecValue('warranty', '1 year', 'en'), '1 year');
  assert.equal(specs.formatSpecValue('ram_type', 'DDR5', 'fr'), 'DDR5');
  // Every option offered in the forms that is a plain word has French and Arabic
  const words = ['Curved', 'Aluminum', 'Mechanical', 'Over-ear headphones', 'Inkjet', 'No warranty', 'Air cooler'];
  for (const w of words) {
    const key = Object.keys(specs.SPEC_FIELDS).find((k) => specs.SPEC_FIELDS[k].options?.includes(w));
    assert.ok(key, w);
    assert.notEqual(specs.formatSpecValue(key, w, 'fr'), w, `fr ${w}`);
    assert.notEqual(specs.formatSpecValue(key, w, 'ar'), w, `ar ${w}`);
  }
});

test('B: no English "COD" in French; compare and screen-reader texts translated', () => {
  assert.doesNotMatch(src('i18n/fr.ts'), /\bCOD\b/);
  assert.doesNotMatch(src('lib/help/fr.ts'), /\bCOD\b/);
  assert.match(src('lib/help/fr.ts'), /« Commander, paiement à la livraison »/, 'the guide names the real button');
  assert.equal(i18n.translate('fr', 'checkout.placeOrder'), 'Commander, paiement à la livraison');
  assert.match(src('components/product/ProductCard.tsx'), /toast\.info\(t\('compare\.removed'\)\)/);
  for (const lang of ['en', 'fr', 'ar']) {
    for (const key of ['compare.removed', 'ui.homeLink', 'ui.close']) assert.notEqual(i18n.translate(lang, key), key, `${lang} ${key}`);
  }
  assert.doesNotMatch(src('components/ui/Toaster.tsx'), /aria-label="Dismiss"/);
  assert.doesNotMatch(src('components/brand/BrandLogo.tsx'), /aria-label="Brynoxa home"/);
});

test('C: staff only see buttons and links the server accepts from them', async () => {
  const perms = await import(pathToFileURL(path.join(root, 'frontend/src/lib/permissions.ts')).href);
  assert.equal(perms.canOpenAdminPath('orders', '/admin/emails?to=a@b.c'), false);
  assert.equal(perms.canOpenAdminPath('support', '/admin/inventory/products/1'), false);
  assert.equal(perms.canOpenAdminPath('catalog', '/admin/customers/1'), false);
  assert.equal(perms.canOpenAdminPath('admin', '/admin/emails'), true);
  assert.equal(perms.canOpenAdminPath('orders', '/admin/orders/1'), true);
  const customers = src('pages/admin/Customers.tsx');
  assert.match(customers, /onToggle=\{canEdit \? \(row\) => setToggleRow\(row\) : undefined\}/);
  assert.match(customers, /onSave=\{canSaveSegments \? onSaveSegment : undefined\}/);
  assert.match(src('components/admin/DepositsView.tsx'), /\{!canEditOptions \? null : showOptions \?/);
  assert.match(src('pages/admin/ProductForm.tsx'), /enabled: canOpenSettings,/);
  for (const f of ['pages/admin/OrderDetail.tsx', 'components/admin/OrderReturnPanel.tsx', 'components/admin/customers/ProfileActivity.tsx', 'pages/admin/InventoryReturn.tsx']) {
    assert.match(src(f), /<StaffLink/, f);
  }
});

test('D: no reviews leftovers; plain wording; labels instead of raw codes', () => {
  assert.doesNotMatch(src('pages/admin/Roles.tsx'), /label: 'Reviews'/);
  assert.doesNotMatch(src('pages/admin/CustomerProfile.tsx'), /wishlist and reviews/);
  assert.doesNotMatch(src('pages/admin/PushNotifications.tsx'), /VAPID_PUBLIC_KEY/);
  assert.doesNotMatch(src('components/admin/OrderReturnPanel.tsx'), /The server won't accept/);
  assert.match(src('pages/admin/Dashboard.tsx'), /\{PAYMENT_LABEL\[o\.paymentStatus\] \?\? o\.paymentStatus\}/);
  assert.match(src('components/admin/inventory/ReceiveProductPicker.tsx'), /CONDITION_LABEL\[p\.condition\]/);
  assert.match(src('components/layout/AdminTopbar.tsx'), /order\$\{stats\.data\.todayOrders === 1 \? '' : 's'\} today/);
  assert.match(src('app/layouts/AdminLayout.tsx'), /required for the owner account/);
  assert.doesNotMatch(src('pages/admin/Settings.tsx'), /and sessions/);
});

test('home top product: while it loads, a loading copy of the card (spinner, lines, deal row) instead of an empty space', () => {
  const card = src('components/home/HomeSpotlight.tsx');
  const skeleton = card.slice(card.indexOf('export function HomeSpotlightSkeleton'));
  assert.match(skeleton, /bg-\[#0b1116\]/, 'the same dark card in light and dark mode');
  assert.match(skeleton, /<ImageSpinner size="lg" tone="dark" \/>/, 'the loading spinner the other products use');
  assert.match(skeleton, /Array\.from\(\{ length: 4 \}/, 'the row of deals underneath');
  assert.doesNotMatch(skeleton.slice(skeleton.indexOf('return (')), /border-white\/10 bg-white\/10 \[@media/, 'not the see-through box any more');
  assert.equal((src('pages/store/Home.tsx').match(/<HomeSpotlightSkeleton \/>/g) || []).length, 2, 'phones and desktop');
});
