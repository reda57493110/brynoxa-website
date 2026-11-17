// Project clean-up (Nov 2026): unused code from removed features stays removed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('reviews are gone from permissions and the dashboard (the old data is kept for account deletion)', () => {
  const { ROLE_PERMISSIONS } = require(dist('permissions.js'));
  assert.ok(!Object.values(ROLE_PERMISSIONS).flat().includes('reviews'));
  assert.ok(!read('frontend/src/lib/permissions.ts').includes("'reviews'"));
  assert.ok(!read('backend/src/services/admin.service.ts').includes('Review.countDocuments'), 'no wasted count on each dashboard load');
  assert.ok(read('backend/src/services/admin.service.ts').includes('Review.deleteMany({ user: user._id })'), 'a deleted account still loses its old reviews');
});

test('unused pieces stay removed', () => {
  assert.ok(!fs.existsSync(path.join(ROOT, 'frontend/src/components/admin/HomeDealsSettings.tsx')));
  assert.ok(!read('frontend/src/components/layout/StoreHero.tsx').includes('heroChip'));
  assert.ok(!read('frontend/src/lib/consent.ts').includes('onConsentChange'));
  assert.ok(!read('frontend/src/lib/localePath.ts').includes('PREFIXED_LOCALES'));
});
