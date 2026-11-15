// Settings → General → Store identity: the name, logo and slogan saved once and shown all over
// the shop and in emails.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('only a logo uploaded through the admin is accepted; slogans are tidied', () => {
  const { sanitizeBranding, brandingIssue } = require(dist('utils/branding.js'));
  const id = 'a'.repeat(24);
  assert.equal(sanitizeBranding({ logo: `/api/v1/images/${id}` }).logo, `/api/v1/images/${id}`);
  assert.equal(sanitizeBranding({ logo: 'https://res.cloudinary.com/x/image/upload/v1/brynoxa/logo.png' }).logo, 'https://res.cloudinary.com/x/image/upload/v1/brynoxa/logo.png');
  for (const bad of ['https://evil.test/logo.png', 'javascript:alert(1)', '/api/v1/images/../x', '<img>']) {
    assert.equal(sanitizeBranding({ logo: bad }).logo, '', bad);
    assert.match(brandingIssue({ logo: bad }), /upload the picture here/);
  }
  const out = sanitizeBranding({ tagline: { fr: '  Votre   PC  livré ', en: 'x'.repeat(300) } }, { logo: `/api/v1/images/${id}`, tagline: { ar: 'عربي' } });
  assert.equal(out.logo, `/api/v1/images/${id}`, 'logo not sent: kept');
  assert.equal(out.tagline.fr, 'Votre PC livré');
  assert.equal(out.tagline.en.length, 120);
  assert.equal(out.tagline.ar, 'عربي', 'kept');
  const { settingsUpdateSchema } = require(dist('validators/schemas.js'));
  assert.ok(!settingsUpdateSchema.safeParse({ branding: { logo: 'https://evil.test/x.png' } }).success);
  assert.ok(settingsUpdateSchema.safeParse({ storeName: 'TechZone', branding: { logo: '', tagline: { en: 'Fast PCs' } } }).success);
  assert.ok(!settingsUpdateSchema.safeParse({ storeName: '' }).success, 'a name is required');
});

test('emails carry the current name and logo', () => {
  const { brandEmail } = require(dist('utils/branding.js'));
  const { renderEmail, siteUrl } = require(dist('services/emailTemplate.js'));
  const html = renderEmail({ preheader: 'p', heading: 'Your Brynoxa order', body: '<p>Thanks for shopping at Brynoxa</p>' });
  const same = brandEmail({ subject: 'Brynoxa order', html }, { storeName: 'Brynoxa' }, siteUrl);
  assert.equal(same.html, html, 'built-in name: unchanged');
  const id = 'b'.repeat(24);
  const out = brandEmail({ subject: 'Your Brynoxa order', html, text: 'Brynoxa' }, { storeName: 'Tech & Co', logo: `/api/v1/images/${id}` }, siteUrl);
  assert.equal(out.subject, 'Your Tech & Co order');
  assert.equal(out.text, 'Tech & Co');
  assert.ok(!out.html.includes('Brynoxa') && !out.html.includes('Bryno<span'), 'no old name left');
  assert.ok(out.html.includes('Tech &amp; Co'), 'escaped in the email');
  assert.ok(out.html.includes(siteUrl(`/api/v1/images/${id}`)), 'the new logo, complete address');
  assert.ok(read('backend/src/services/email.service.ts').includes('...brandEmail(input, { storeName: s.storeName, logo: s.branding?.logo }, siteUrl)'));
});

test('saved on both paths; public for the shop', () => {
  const { Settings, publicSettings } = require(dist('models/Settings.js'));
  const pub = publicSettings(new Settings({ storeName: 'TechZone', branding: { tagline: { en: 'Fast PCs' } } }));
  assert.equal(pub.storeName, 'TechZone');
  assert.equal(pub.branding.tagline.en, 'Fast PCs');
  assert.ok(read('api/v1/settings.js').includes('settings[key] = sanitizeBranding(body[key], current);'));
  assert.ok(read('backend/src/controllers/misc.controller.ts').includes('body.branding = sanitizeBranding(body.branding, settings.branding);'));
});

test('the shop reads the identity everywhere (no fixed name left in shop pages)', () => {
  const f = (p) => read(path.join('frontend/src', p));
  assert.ok(f('components/brand/BrandLogo.tsx').includes('src={BRAND.logo}'));
  assert.ok(f('components/layout/Footer.tsx').includes("{brandTagline(locale) || t('footer.tagline')}"));
  assert.ok(f('i18n/index.ts').includes('return withBrand(text)'));
  assert.ok(f('components/legal/LegalSectionContent.tsx').includes('withBrand(text)'));
  for (const p of ['pages/store/Shop.tsx', 'pages/store/ServiceDetail.tsx', 'pages/store/ForgotPassword.tsx', 'pages/store/ResetPassword.tsx', 'pages/store/VerifyEmail.tsx', 'lib/productSeo.ts', 'lib/structuredData.ts', 'hooks/useSeo.ts', 'components/layout/MobileNav.tsx', 'pages/admin/DeliverySlips.tsx']) {
    const lines = f(p).split(/\r?\n/).filter((l) => /Brynoxa/.test(l) && !/^\s*(\/\/|\*|\/\*)/.test(l));
    assert.deepEqual(lines, [], p);
  }
  const general = f('components/admin/settings/StoreSettings.tsx');
  assert.ok(general.includes('branding: { logo, tagline: tagTrim },'), 'saved from Settings → General');
});
