// Settings → Contact & business (numbers, social pages, legal details), Settings → Delivery and
// Settings → Catalog → Brands: saved the same way locally and on the live site.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('numbers: typed any way, saved as international digits', () => {
  const { normalizePhone } = require(dist('utils/siteContact.js'));
  for (const v of ['07 79 31 80 61', '+212 779-318061', '00212779318061', '212779318061', '0779318061']) {
    assert.equal(normalizePhone(v), '212779318061', v);
  }
  assert.equal(normalizePhone('+33 6 12 34 56 78'), '33612345678');
  for (const v of ['123', 'abc', '0612', '']) assert.equal(normalizePhone(v), '', v);
});

test('social pages must be on their own site; https; no tricks', () => {
  const { normalizeSocialUrl } = require(dist('utils/siteContact.js'));
  assert.equal(normalizeSocialUrl('instagram', 'instagram.com/brynoxa1'), 'https://instagram.com/brynoxa1');
  assert.equal(normalizeSocialUrl('instagram', 'http://www.instagram.com/brynoxa1'), 'https://www.instagram.com/brynoxa1');
  assert.equal(normalizeSocialUrl('tiktok', 'https://www.tiktok.com/@brynoxa'), 'https://www.tiktok.com/@brynoxa');
  assert.equal(normalizeSocialUrl('youtube', 'youtu.be/x'), 'https://youtu.be/x');
  assert.equal(normalizeSocialUrl('facebook', 'https://m.facebook.com/brynoxa'), 'https://m.facebook.com/brynoxa');
  for (const bad of ['https://evil.test/instagram.com', 'https://instagram.com.evil.test/x', 'javascript:alert(1)', 'https://user:pw@instagram.com/x']) {
    assert.equal(normalizeSocialUrl('instagram', bad), '', bad);
  }
  assert.equal(normalizeSocialUrl('facebook', 'https://instagram.com/x'), '', 'the right site for each');
});

test('a bad value is refused with a message (both save paths use the same schema)', () => {
  const { settingsUpdateSchema, settingsSchema, settingsIssueMessage } = require(dist('validators/schemas.js'));
  assert.ok(settingsUpdateSchema.safeParse({ siteContact: { whatsapp: '06 12 34 56 78', instagram: 'instagram.com/x', ice: '001234567000089' } }).success);
  const bad = settingsUpdateSchema.safeParse({ siteContact: { whatsapp: '0612' } });
  assert.ok(!bad.success);
  assert.match(settingsIssueMessage(bad.error.issues[0]), /WhatsApp: enter a full number/);
  assert.ok(!settingsSchema.safeParse({ siteContact: { facebook: 'https://evil.test' } }).success);
  assert.ok(!settingsSchema.safeParse({ siteContact: { ice: 'ABC' } }).success);
  assert.ok(settingsSchema.safeParse({ siteContact: { whatsapp: '', facebook: '' } }).success, 'empty = built-in / hidden');
  // delivery prices: no negative or absurd price for a city
  assert.ok(!settingsSchema.safeParse({ shippingByCity: [{ city: 'Rabat', rate: -5 }] }).success);
  assert.ok(!settingsSchema.safeParse({ shippingByCity: [{ city: 'Rabat', rate: 1e9 }] }).success);
  assert.ok(settingsUpdateSchema.safeParse({ shippingFlatRate: 35, freeShippingMin: 3000, shippingByCity: [{ city: 'Rabat', rate: 20 }] }).success);
});

test('saving keeps fields not sent, cleans the rest; the shop can read it (public)', () => {
  const { sanitizeSiteContact } = require(dist('utils/siteContact.js'));
  const current = { whatsapp: '212600000000', instagram: 'https://instagram.com/old' };
  const out = sanitizeSiteContact({ phone: '0522 11 22 33', ice: '0012 3456 7000 089', businessName: '  Brynoxa   SARL ' }, current);
  assert.equal(out.whatsapp, '212600000000', 'kept');
  assert.equal(out.instagram, 'https://instagram.com/old', 'kept');
  assert.equal(out.phone, '212522112233');
  assert.equal(out.ice, '001234567000089');
  assert.equal(out.businessName, 'Brynoxa SARL');
  assert.equal(sanitizeSiteContact({ instagram: '' }, current).instagram, '', 'emptied = removed');

  const { Settings, publicSettings } = require(dist('models/Settings.js'));
  const doc = new Settings({ siteContact: { whatsapp: '212611111111' } });
  assert.equal(publicSettings(doc).siteContact.whatsapp, '212611111111', 'not a private setting');
  assert.equal(new Settings({}).siteContact.facebook, '', 'defaults to empty');

  assert.ok(read('api/v1/settings.js').includes("  'siteContact',\n") || read('api/v1/settings.js').includes("  'siteContact',\r\n"), 'live site saves it');
  assert.ok(read('api/v1/settings.js').includes('settings[key] = sanitizeSiteContact(body[key], current);'));
  assert.ok(read('backend/src/controllers/misc.controller.ts').includes('body.siteContact = sanitizeSiteContact(body.siteContact, settings.siteContact);'));
});

test('brands: staff list says how many products use each brand', async () => {
  const { Brand } = require(dist('models/Brand.js'));
  const { Product } = require(dist('models/Product.js'));
  const catalog = require(dist('services/catalog.service.js'));
  const orig = { find: Brand.find, aggregate: Product.aggregate };
  Brand.find = () => ({ sort: () => ({ lean: async () => [{ _id: 'a1', name: 'HP' }, { _id: 'b2', name: 'Lenovo' }] }) });
  Product.aggregate = async () => [{ _id: 'a1', n: 7 }];
  try {
    const list = await catalog.listBrands(false);
    assert.deepEqual(list.map((b) => [b.name, b.productCount]), [['HP', 7], ['Lenovo', 0]]);
  } finally {
    Brand.find = orig.find;
    Product.aggregate = orig.aggregate;
  }
});

test('admin: Contact & business, Delivery sections; Brands in Catalog; search finds them', () => {
  const f = (p) => read(path.join('frontend/src', p));
  const s = f('pages/admin/Settings.tsx');
  assert.ok(s.includes("type SectionId = 'general' | 'contact' | 'delivery' | 'catalog' | 'customers' | 'tracking' | 'notifications'"));
  assert.ok(s.includes('<ContactSettings settings={settings} />') && s.includes('<DeliverySettings settings={settings} />') && s.includes('<BrandsSettings />'));
  const search = f('lib/adminSearch.ts');
  for (const to of ["to: '/admin/settings?tab=contact'", "to: '/admin/settings?tab=delivery'"]) assert.ok(search.includes(to), to);
  assert.ok(f('api/adminApi.ts').includes('remove: (id: string) => api.delete<ApiResponse<null>>(`/admin/brands/${id}`),'));
  // every layout applies the saved contact details
  for (const p of ['app/layouts/StoreLayout.tsx', 'app/layouts/AdminLayout.tsx', 'app/layouts/AuthLayout.tsx', 'pages/admin/DeliverySlips.tsx']) {
    assert.ok(f(p).includes('  useSiteContactSync()'), p);
  }
  // server and shop clean numbers / pages the same way
  const back = read('backend/src/utils/siteContact.ts');
  const front = f('lib/siteContact.ts');
  for (const line of ["  else if (/^0\\d{9}$/.test(d)) d = `212${d.slice(1)}`", "  return /^[1-9]\\d{7,14}$/.test(d) ? d : ''", '    const ok = SOCIAL_HOSTS[key].some((h) => host === h || host.endsWith(`.${h}`))']) {
    assert.ok(back.includes(line) && front.includes(line), line);
  }
});
