// Admin → Social media: followers / posts typed by staff (one row per platform and day), the
// growth chart, and one click to each platform's messages, posts and stats. No connection to the
// platforms (the "Connect" developer-app code was removed, with its public return addresses).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('numbers typed by staff: one row per platform and day; shown on the cards and the chart', async () => {
  const social = require(dist('services/social.service.js'));
  const { SocialSnapshot } = require(dist('models/SocialSnapshot.js'));
  const { socialNumbersSchema } = require(dist('validators/schemas.js'));
  assert.ok(socialNumbersSchema.safeParse({ day: '2026-11-15', entries: [{ platform: 'instagram', followers: 3870, posts: 64 }] }).success);
  assert.ok(!socialNumbersSchema.safeParse({ day: '2026-11-15', entries: [{ platform: 'myspace', followers: 1 }] }).success);
  assert.ok(!socialNumbersSchema.safeParse({ day: '2026-11-15', entries: [{ platform: 'tiktok', followers: -4 }] }).success);
  assert.ok(!socialNumbersSchema.safeParse({ day: '2026-11-15', entries: [] }).success);

  const orig = { upd: SocialSnapshot.updateOne, find: SocialSnapshot.find, del: SocialSnapshot.deleteOne };
  const writes = [];
  SocialSnapshot.updateOne = async (q, u, o) => writes.push({ q, set: u.$set, o });
  try {
    await social.saveNumbers({ day: '2026-11-15', entries: [{ platform: 'instagram', followers: 3870, posts: 64 }, { platform: 'tiktok', followers: 950 }] });
    assert.deepEqual(writes.map((w) => [w.q.platform, w.q.day, w.set.followers, w.set.manual, w.o.upsert]), [
      ['instagram', '2026-11-15', 3870, true, true],
      ['tiktok', '2026-11-15', 950, true, true],
    ]);
    await assert.rejects(() => social.saveNumbers({ day: '2999-01-01', entries: [{ platform: 'tiktok', followers: 1 }] }), /today or a past day/);

    const day = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
    SocialSnapshot.find = () => ({ sort: () => ({ lean: async () => [
      { platform: 'instagram', day: day(20), followers: 3500, posts: 60, manual: true },
      { platform: 'instagram', day: day(1), followers: 3870, posts: 64, manual: true },
    ] }) });
    const o = await social.overview();
    assert.deepEqual(o.platforms.map((p) => p.platform), ['facebook', 'instagram', 'tiktok']);
    const ig = o.platforms.find((p) => p.platform === 'instagram');
    assert.deepEqual([ig.followers, ig.posts, ig.typedOn], [3870, 64, day(1)]);
    assert.equal(o.platforms.find((p) => p.platform === 'facebook').followers, undefined, 'nothing typed yet');
    assert.equal(o.growth.length, 2, 'the chart');
    assert.equal(o.typed[0].day, day(1), 'newest first');

    let removed;
    SocialSnapshot.deleteOne = async (q) => (removed = q);
    await social.deleteNumbers('instagram', day(1));
    assert.deepEqual(removed, { platform: 'instagram', day: day(1), manual: true }, 'only typed numbers can be removed');
    await assert.rejects(() => social.deleteNumbers('x', 'y'), /Not found/);
  } finally {
    Object.assign(SocialSnapshot, { updateOne: orig.upd, find: orig.find, deleteOne: orig.del });
  }
});

test('rights: owner and Marketing ("ads"); staff log; menu, address and search', () => {
  const routes = read('backend/src/routes/social.routes.ts');
  assert.equal((routes.match(/requirePermission\('ads'\)/g) || []).length, 3);
  assert.ok(!/route === 'social'|startsWith\('social/.test(read('api/v1/admin.js')), 'admin routes reach Express');
  const { describeStaffAction } = require(dist('utils/staffActions.js'));
  assert.equal(describeStaffAction('POST', 'admin/social/numbers').action, 'Updated social media numbers');
  assert.equal(describeStaffAction('DELETE', 'admin/social/numbers/instagram/2026-11-15').action, 'Removed social media numbers');
  const f = (p) => read(path.join('frontend/src', p));
  assert.ok(f('components/layout/AdminSidebar.tsx').includes("{ to: '/admin/social', label: 'Social media', icon: 'chat', group: 'Marketing' },"));
  assert.ok(f('lib/permissions.ts').includes("'/admin/social': 'ads',"));
  assert.ok(f('app/router.tsx').includes('<Route path="social" element={<S><AdminSocial /></S>} />'));
});

test('the page: shortcuts, a page per account with one click to its messages / posts / stats', () => {
  const page = read('frontend/src/pages/admin/Social.tsx');
  for (const href of ['https://business.facebook.com/latest/inbox/all', 'https://business.facebook.com/latest/insights', 'https://www.tiktok.com/tiktokstudio/analytics', 'https://business.facebook.com/latest/inbox/messenger', 'https://business.facebook.com/latest/inbox/instagram_direct', 'https://www.tiktok.com/tiktokstudio/content']) {
    assert.ok(page.includes(href), href);
  }
  assert.ok(page.includes('onOpen={() => setParams({ platform: p.platform })}'));
  assert.ok(page.includes('const growth = data.growth.filter((g) => g.platform === p.platform)'), 'its own chart');
  assert.ok(!/metricool/i.test(page), 'no Metricool');
});

test('no connection to the platforms is left: no return addresses, no stored keys, no developer-app settings', () => {
  for (const gone of ['backend/src/models/SocialAccount.ts', 'backend/src/utils/secretBox.ts']) assert.ok(!fs.existsSync(path.join(ROOT, gone)), gone);
  const routes = read('backend/src/routes/social.routes.ts');
  assert.ok(!routes.includes('/social/meta/callback') && !routes.includes('/connect') && !routes.includes('/reply'));
  const service = read('backend/src/services/social.service.ts');
  assert.ok(!/fetch\(|graph\.facebook|tiktokapis|access_token/.test(service), 'the server never calls the platforms');
  assert.ok(!read('backend/.env.example').includes('META_APP_ID'));
  const page = read('frontend/src/pages/admin/Social.tsx');
  assert.ok(!/Connect automatically|connect\(|Disconnect|SetupGuide/.test(page));
});
