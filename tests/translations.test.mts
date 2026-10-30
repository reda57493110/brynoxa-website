// Scan fixes, group 4 (languages and Google):
// 21 server messages and notifications are shown in the customer's language;
// 22 Arabic: arrows turn around, spacing follows the reading direction;
// 23 no English left on the error screen, photo buttons and sign-in errors;
// 24 Google: private pages are not indexed, unknown addresses are a real "not found";
// 25 shoppers never get sales counts or stock locations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
const load = (p: string) => import(pathToFileURL(path.join(root, 'frontend/src', p)).href);

const i18n = await load('i18n/index.ts');
await i18n.loadLocale('fr');
await i18n.loadLocale('ar');
const { localizeServerMessage } = await load('lib/serverMessages.ts');
const { localizeNotification } = await load('lib/notificationText.ts');

test('21: server messages in French and Arabic; English and unknown messages unchanged', () => {
  assert.equal(localizeServerMessage('Invalid email or password', 'fr'), 'Email ou mot de passe incorrect');
  assert.equal(localizeServerMessage('Coupon expired', 'ar'), 'انتهت صلاحية رمز الخصم هذا.');
  assert.equal(localizeServerMessage('Minimum order of 1500 DH required', 'fr'), 'Ce code promo demande une commande d’au moins 1500 DH.');
  assert.equal(localizeServerMessage('Insufficient stock for HP EliteBook 840', 'fr'), 'Stock insuffisant pour HP EliteBook 840.');
  assert.match(localizeServerMessage('Too many sign-in attempts. Please wait a few minutes and try again.', 'ar'), /محاولات كثيرة/);
  assert.equal(localizeServerMessage('Invalid email or password', 'en'), 'Invalid email or password');
  assert.equal(localizeServerMessage('Some new message', 'fr'), 'Some new message');
  // Every key used exists in all three languages
  const keys = [...src('lib/serverMessages.ts').matchAll(/'(server\.\w+)'/g)].map((m) => m[1]);
  for (const lang of ['en', 'fr', 'ar']) for (const key of keys) assert.notEqual(i18n.translate(lang, key), key, `${lang}: ${key}`);
  assert.match(src('api/client.ts'), /return shown\(data\?\.message \|\| fallback\)/);
});

test('21: notifications (also older ones) are shown in the customer’s language, order number kept', () => {
  const t = (lang: string) => (key: string, vars?: Record<string, string>) => i18n.translate(lang, key, vars);
  const shipped = localizeNotification(
    { title: 'Order shipped', message: 'Your order is on the way. The courier will contact you for cash on delivery. (BRX-20261029-K7M2QX)' },
    t('fr')
  );
  assert.equal(shipped.title, 'Commande expédiée');
  assert.match(shipped.message, /^Votre commande est en route\..* \(BRX-20261029-K7M2QX\)$/);
  const moved = localizeNotification({ title: 'Delivery rescheduled', message: 'Your delivery has been rescheduled. New date: Sat 31 Oct. (BRX-1)' }, t('fr'));
  assert.equal(moved.message, 'Votre livraison a été reportée. Nouvelle date : Sat 31 Oct. (BRX-1)');
  const deposit = localizeNotification({ title: 'Order deposit', message: 'A deposit of 1,000 DH is needed to confirm this order (BRX-1)' }, t('ar'));
  assert.equal(deposit.message, 'يلزم دفع عربون قدره 1,000 DH لتأكيد هذا الطلب (BRX-1)');
  const other = { title: 'Welcome', message: 'Hello' };
  assert.deepEqual(localizeNotification(other, t('fr')), other);
  // Every status the server notifies about has a translation (backend orderNotify.service.ts)
  const server = fs.readFileSync(path.join(root, 'backend/src/services/orderNotify.service.ts'), 'utf8');
  for (const [, title] of server.matchAll(/title: '([^']+)',\n\s+customerLine/g)) {
    assert.notEqual(localizeNotification({ title, message: 'x (BRX-1)' }, t('fr')).title, title, title);
  }
});

test('22: Arabic layout — arrows turn around, spacing follows the reading direction', () => {
  assert.match(src('components/layout/Navbar.tsx'), /ms-auto flex items-center gap-0 md:ms-1/);
  for (const f of ['components/ui/Pagination.tsx', 'components/product/ImageGallery.tsx']) {
    assert.equal((src(f).match(/name="chevron-(left|right)" size=\{\d+\} className="rtl:rotate-180"/g) || []).length, 2, f);
  }
});

test('23: error screen, photo buttons and sign-in errors are translated', () => {
  assert.doesNotMatch(src('components/ui/ErrorBoundary.tsx'), />Something went wrong</);
  assert.doesNotMatch(src('components/order/PrivatePhoto.tsx'), /'Open photo'|"Delete photo"|'Open full size'/);
  assert.doesNotMatch(src('pages/store/Login.tsx'), /Server is starting/);
  assert.equal(i18n.translate('ar', 'errorPage.refresh'), 'تحديث الصفحة');
});

test('24: Google — private pages not indexed, made-up addresses are "not found"', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const app = vercel.rewrites.filter((r: { destination: string }) => r.destination === '/index.html');
  const isApp = (p: string) => app.some((r: { source: string }) => new RegExp(`^${r.source.replace(/^\/\(\(/, '/((').replace(/^\/$/, '/')}$`).test(p));
  for (const p of ['/', '/fr', '/ar/', '/shop', '/fr/product/hp-840', '/admin/orders/1', '/help', '/ar/terms']) assert.ok(isApp(p), p);
  for (const p of ['/nope', '/fr/nope', '/shopping', '/wp-login.php']) assert.ok(!isApp(p), p);
  const noindex = vercel.headers.find((h: { headers: { key: string }[] }) => h.headers.some((x) => x.key === 'X-Robots-Tag'));
  for (const p of ['/account', '/fr/checkout', '/reset-password', '/admin/settings']) assert.ok(new RegExp(`^${noindex.source}$`).test(p), p);
  assert.ok(!new RegExp(`^${noindex.source}$`).test('/shop'));
  assert.match(fs.readFileSync(path.join(root, 'frontend/vite.config.ts'), 'utf8'), /copyFileSync\(path\.join\(outDir, 'index\.html'\), path\.join\(outDir, '404\.html'\)\)/);
  const robots = fs.readFileSync(path.join(root, 'frontend/public/robots.txt'), 'utf8');
  for (const p of ['/reset-password', '/fr/order-confirmation', '/ar/verify-email']) assert.match(robots, new RegExp(`Disallow: ${p}\\n`));
});

test('25: shoppers never get sales counts or stock locations', () => {
  const b = (p: string) => fs.readFileSync(path.join(root, 'backend/src', p), 'utf8');
  assert.match(b('utils/publicProduct.ts'), /\['soldCount', 'inventoryLocation'\]/);
  assert.equal((b('services/catalog.service.ts').match(/HIDE_PRIVATE_PRODUCT_FIELDS/g) || []).length, 4, 'list, product page, compare / deals + import');
  assert.match(b('services/recommendation.service.ts'), /items = items\.map\(withoutPrivateFields\)/);
  assert.match(b('services/wishlist.service.ts'), /select: HIDE_PRIVATE_PRODUCT_FIELDS/);
});
