// Settings → Tracking codes: only well-formed ids are saved (never a script), on both save paths;
// the browser is allowed to load Meta's and TikTok's official scripts.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('ids are checked and tidied; pasted code is refused', () => {
  const { sanitizeTracking, trackingIssue } = require(dist('utils/tracking.js'));
  assert.deepEqual(sanitizeTracking({ metaPixelId: ' 1234567890123456 ', tiktokPixelId: 'cabcd1234efgh5678ijk', gaMeasurementId: 'g-ab12cd34ef' }), {
    metaPixelId: '1234567890123456',
    tiktokPixelId: 'CABCD1234EFGH5678IJK',
    gaMeasurementId: 'G-AB12CD34EF',
  });
  assert.equal(sanitizeTracking({ gaMeasurementId: '' }, { metaPixelId: '1234567890' }).metaPixelId, '1234567890', 'fields not sent are kept');
  assert.match(trackingIssue({ metaPixelId: "<script>fbq('init','1')</script>" }), /Meta Pixel ID/);
  assert.match(trackingIssue({ gaMeasurementId: 'UA-1234-1' }), /G-/);
  assert.equal(trackingIssue({ metaPixelId: '', tiktokPixelId: '' }), null, 'empty = not loaded');
  const { settingsUpdateSchema } = require(dist('validators/schemas.js'));
  assert.ok(!settingsUpdateSchema.safeParse({ tracking: { tiktokPixelId: 'javascript:alert(1)' } }).success);
  assert.ok(settingsUpdateSchema.safeParse({ tracking: { metaPixelId: '1234567890123456' } }).success);
});

test('saved on both paths, public for the shop, same checks in the shop', () => {
  const { Settings, publicSettings } = require(dist('models/Settings.js'));
  assert.equal(publicSettings(new Settings({ tracking: { metaPixelId: '1234567890' } })).tracking.metaPixelId, '1234567890');
  assert.ok(read('api/v1/settings.js').includes('settings[key] = sanitizeTracking(body[key], current);'));
  assert.ok(read('backend/src/controllers/misc.controller.ts').includes('body.tracking = sanitizeTracking(body.tracking, settings.tracking);'));
  const back = read('backend/src/utils/tracking.ts');
  const front = read('frontend/src/lib/analytics.ts');
  for (const rx of ['/^\\d{10,20}$/', '/^[A-Z0-9]{15,30}$/', '/^G-[A-Z0-9]{4,16}$/']) assert.ok(back.includes(rx) && front.includes(rx), rx);
});

test('security rules allow only the official Meta / TikTok / Google addresses', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key === 'Content-Security-Policy').value;
  const script = csp.split(';').find((d) => d.trim().startsWith('script-src'));
  assert.equal(script.trim(), "script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://analytics.tiktok.com");
  assert.ok(!script.includes('unsafe'), 'still no inline scripts');
  const connect = csp.split(';').find((d) => d.trim().startsWith('connect-src'));
  for (const host of ['https://www.facebook.com', 'https://analytics.tiktok.com']) assert.ok(connect.includes(host), host);
});

test('admin: Tracking codes section; the shop layout loads them (not admin)', () => {
  const f = (p) => read(path.join('frontend/src', p));
  assert.ok(f('pages/admin/Settings.tsx').includes('<TrackingSettings settings={settings} />'));
  assert.ok(f('app/layouts/StoreLayout.tsx').includes('  useTrackingSync()'));
  assert.ok(!f('app/layouts/AdminLayout.tsx').includes('useTrackingSync'));
  assert.ok(f('pages/admin/Ads.tsx').includes('to="/admin/settings?tab=tracking"'), 'Ads page points to it');
});

test('cookie consent: banner on shop pages, footer link, privacy policy says it in 3 languages', () => {
  const f = (p) => read(path.join('frontend/src', p));
  assert.ok(f('app/layouts/StoreLayout.tsx').includes('<CookieBanner />'));
  assert.ok(f('components/layout/Footer.tsx').includes("{t('consent.settings')}"));
  const banner = f('components/legal/CookieBanner.tsx');
  assert.ok(banner.includes("onClick={() => choose('denied')}") && banner.includes("onClick={() => choose('granted')}"), 'refuse as easy as accept');
  const legal = f('lib/legal.ts');
  assert.ok(!legal.includes('We do not use advertising cookies'), 'the old promise is gone');
  for (const t of ['Only if you accept: audience measurement and advertising cookies', 'Seulement si vous acceptez : des cookies de mesure', 'فقط إذا وافقت: ملفات ارتباط لقياس الزيارات']) assert.ok(legal.includes(t), t);
  for (const l of ['en', 'fr', 'ar']) assert.ok(f(`i18n/${l}.ts`).includes('  consent: {'), l);
  assert.ok(f('lib/analytics.ts').includes('  if (!hasAdConsent()) return\n'), 'Google too waits for consent');
});

test('link previews: complete addresses and a 1200 × 630 picture', () => {
  const html = read('frontend/index.html');
  assert.ok(html.includes('<meta property="og:image" content="/brand/brynoxa-social.png" />'));
  assert.ok(html.includes('<meta property="og:image:width" content="1200" />'));
  const vite = read('frontend/vite.config.ts');
  assert.ok(vite.includes('absoluteShareLinks(), routeChunks()'), 'made complete at build time');
  const png = fs.readFileSync(path.join(ROOT, 'frontend/public/brand/brynoxa-social.png'));
  assert.equal(png.toString('ascii', 1, 4), 'PNG', 'a real PNG');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
});
