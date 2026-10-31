// The shop's contact email is brynoxa.shop@gmail.com. An early placeholder (support@brynoxa.com,
// a domain owned by someone else) was saved in the settings: it is replaced on the next read, so
// replies to staff emails never go to a stranger. The owner can change it in Settings → Store.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const S = require(dist('models/Settings.js'));

function stored(email) {
  const doc = { supportEmail: email, saves: 0 };
  doc.save = async () => {
    doc.saves++;
  };
  S.Settings.findOne = async () => doc;
  return doc;
}

test('the old placeholder is replaced by the real inbox, once', async () => {
  const doc = stored('support@brynoxa.com');
  const s = await S.getSettings();
  assert.equal(s.supportEmail, 'brynoxa.shop@gmail.com');
  assert.equal(doc.saves, 1);
  await S.getSettings();
  assert.equal(doc.saves, 1, 'nothing to fix the second time');
});

test("an email the owner chose is kept as it is", async () => {
  const doc = stored('owner@example.org');
  assert.equal((await S.getSettings()).supportEmail, 'owner@example.org');
  assert.equal(doc.saves, 0);
});

test('new shops start with the real inbox; customers see it; the owner can edit it', () => {
  assert.equal(new S.Settings({}).supportEmail, 'brynoxa.shop@gmail.com');
  const src = (p) => fs.readFileSync(path.join(ROOT, 'frontend/src', p), 'utf8');
  assert.match(src('lib/site.ts'), /value: 'brynoxa\.shop@gmail\.com'/);
  assert.match(src('components/admin/settings/StoreSettings.tsx'), /label="Support email"/);
  assert.match(src('components/admin/settings/StoreSettings.tsx'), /supportEmail: supportEmail\.trim\(\)/);
});
