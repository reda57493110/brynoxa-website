// The shop shows the contact details saved in Admin → Settings → Contact & business: built-in
// ones until then, remembered on the device, and read live (no stale copy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const load = async (rel: string) => import(pathToFileURL(path.join(root, 'frontend/src', rel)).href);
const site = await load('lib/site.ts');
const { formatPhone, socialHandle } = await load('lib/siteContact.ts');

test('built-in details until the owner saves some', () => {
  const { contact, legal, social } = site.siteInfoFrom(null);
  assert.equal(contact.whatsapp.value, '07 79 31 80 61');
  assert.equal(contact.whatsapp.href, 'https://wa.me/212779318061');
  assert.equal(contact.email.value, 'brynoxa.shop@gmail.com');
  assert.equal(legal.businessName, 'Brynoxa');
  assert.deepEqual(social.map((s: { id: string }) => s.id), ['whatsapp', 'facebook', 'instagram']);
});

test('saved details replace them everywhere; the phone follows WhatsApp when empty', () => {
  const { contact, legal, social } = site.siteInfoFrom({
    supportEmail: 'hello@brynoxa.ma',
    siteContact: { whatsapp: '212612345678', tiktok: 'https://www.tiktok.com/@brynoxa', businessName: 'Brynoxa SARL', ice: '001234567000089' },
  });
  assert.equal(contact.whatsapp.value, '06 12 34 56 78');
  assert.equal(contact.phone.href, 'tel:+212612345678');
  assert.equal(contact.email.href, 'mailto:hello@brynoxa.ma');
  assert.equal(legal.businessName, 'Brynoxa SARL');
  assert.equal(legal.ice, '001234567000089');
  assert.deepEqual(social.map((s: { id: string; handle: string }) => [s.id, s.handle]), [['whatsapp', '06 12 34 56 78'], ['tiktok', '@brynoxa']], 'only the pages saved');
});

test('applied live (pages read the new values) and remembered for the next visit', () => {
  assert.equal(site.applySiteSettings({ siteContact: { whatsapp: '212600000001' }, supportEmail: '' }), true);
  assert.equal(site.CONTACT.whatsapp.number, '212600000001');
  assert.equal(site.SOCIAL_LINKS[0].href, 'https://wa.me/212600000001');
  assert.equal(site.applySiteSettings({ siteContact: { whatsapp: '212600000001' }, supportEmail: '' }), false, 'same values: nothing to do');
  assert.ok(store.get('brx-site-contact')?.includes('212600000001'));
  const wa = fs.readFileSync(path.join(root, 'frontend/src/lib/whatsapp.ts'), 'utf8');
  assert.ok(wa.includes('const base = `https://wa.me/${CONTACT.whatsapp.number}`'), 'read when the link is made, not copied at load');
});

test('numbers and page names as customers see them', () => {
  assert.equal(formatPhone('212522112233'), '05 22 11 22 33');
  assert.equal(formatPhone('33612345678'), '+33612345678');
  assert.equal(socialHandle('instagram', 'https://www.instagram.com/brynoxa1/'), '@brynoxa1');
  assert.equal(socialHandle('facebook', 'https://www.facebook.com/profile.php?id=1'), 'Facebook');
});

test('until Contact & business is first saved the shop keeps its pages; once saved, an emptied page is gone', () => {
  assert.deepEqual(site.siteInfoFrom({ siteContact: {} }).social.map((s: { id: string }) => s.id), ['whatsapp', 'facebook', 'instagram']);
  assert.deepEqual(site.siteInfoFrom({ siteContact: { rc: 'RC 1 Rabat' } }).social.map((s: { id: string }) => s.id), ['whatsapp']);
  const form = fs.readFileSync(path.join(root, 'frontend/src/components/admin/settings/ContactSettings.tsx'), 'utf8');
  assert.ok(form.includes('Object.values(saved).some(Boolean) ? saved : { ...saved, ...BUILT_IN_SOCIAL }'), 'the form starts with what the shop shows');
});
