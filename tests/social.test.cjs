// Admin → Social media: the owner connects Facebook + Instagram (Meta) and TikTok with their own
// developer apps; keys are sealed in the database; followers, posts and messages are read from them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv({ META_APP_ID: '111222333', META_APP_SECRET: 'meta-secret-xyz', TIKTOK_CLIENT_KEY: 'tt-key', TIKTOK_CLIENT_SECRET: 'tt-secret' });
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const OWNER = 'a'.repeat(24);

/** Replaces global fetch: answers by matching the address */
function fakeFetch(routes) {
  const calls = [];
  const orig = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const hit = routes.find(([rx]) => rx.test(String(url)));
    const body = hit ? (typeof hit[1] === 'function' ? hit[1](String(url), init) : hit[1]) : { error: { message: 'unexpected ' + url } };
    return { ok: !body.error || body.error.code === 'ok', status: body.error && body.error.code !== 'ok' ? 400 : 200, json: async () => body };
  };
  return { calls, restore: () => (global.fetch = orig) };
}

test('keys are sealed (not readable in the database); the Connect state cannot be forged or reused late', () => {
  const box = require(dist('utils/secretBox.js'));
  const sealed = box.seal('EAAB-page-token');
  assert.ok(!sealed.includes('EAAB'));
  assert.equal(box.unseal(sealed), 'EAAB-page-token');
  const s = box.signState({ p: 'meta', u: OWNER });
  assert.deepEqual({ p: box.readState(s).p, u: box.readState(s).u }, { p: 'meta', u: OWNER });
  const [body, mac] = s.split('.');
  const forged = Buffer.from(JSON.stringify({ p: 'meta', u: 'b'.repeat(24), exp: Date.now() + 1e6 })).toString('base64url');
  assert.equal(box.readState(`${forged}.${mac}`), null, 'another user id with the same signature');
  assert.equal(box.readState(`${body}.x${mac.slice(1)}`), null);
  assert.equal(box.readState(box.signState({ p: 'meta' }, -1)), null, 'expired');
});

test('Connect sends the owner to Meta / TikTok with the right permissions and return address', () => {
  const social = require(dist('services/social.service.js'));
  const meta = new URL(social.connectUrl('meta', OWNER));
  assert.equal(meta.hostname, 'www.facebook.com');
  assert.equal(meta.searchParams.get('client_id'), '111222333');
  assert.equal(meta.searchParams.get('redirect_uri'), 'https://shop.test/api/v1/social/meta/callback');
  for (const s of ['pages_read_engagement', 'instagram_basic', 'instagram_manage_messages', 'pages_messaging']) assert.ok(meta.searchParams.get('scope').includes(s), s);
  assert.ok(!meta.toString().includes('meta-secret-xyz'), 'never the secret');
  // Facebook Login for Business: the configuration replaces the list of permissions
  process.env.META_CONFIG_ID = '987654321012';
  const biz = new URL(social.connectUrl('meta', OWNER));
  assert.equal(biz.searchParams.get('config_id'), '987654321012');
  assert.equal(biz.searchParams.get('scope'), null);
  process.env.META_CONFIG_ID = 'not-an-id';
  assert.equal(new URL(social.connectUrl('meta', OWNER)).searchParams.get('config_id'), null, 'a bad value is ignored');
  delete process.env.META_CONFIG_ID;
  const tt = new URL(social.connectUrl('tiktok', OWNER));
  assert.equal(tt.hostname, 'www.tiktok.com');
  assert.equal(tt.searchParams.get('scope'), 'user.info.basic,user.info.profile,user.info.stats,video.list');
});

test('Meta callback: only for the owner who pressed Connect; Page + Instagram saved, keys sealed', async () => {
  const social = require(dist('services/social.service.js'));
  const box = require(dist('utils/secretBox.js'));
  const { User } = require(dist('models/User.js'));
  const { SocialAccount } = require(dist('models/SocialAccount.js'));
  const origFind = User.findById;
  const origSave = SocialAccount.findOneAndUpdate;
  const saved = [];
  let role = 'admin';
  User.findById = () => ({ select: () => ({ lean: async () => ({ _id: OWNER, role, isActive: true }) }) });
  SocialAccount.findOneAndUpdate = async (q, u) => saved.push({ q, u });
  const f = fakeFetch([
    [/oauth\/access_token.*code=/, { access_token: 'short-user' }],
    [/oauth\/access_token.*fb_exchange_token/, { access_token: 'long-user' }],
    [/\/me\/accounts/, { data: [{ id: '9001', name: 'Brynoxa', access_token: 'PAGE-TOKEN-1', instagram_business_account: { id: '1784', username: 'brynoxa1' } }] }],
  ]);
  try {
    const state = box.signState({ p: 'meta', u: OWNER });
    assert.equal(await social.metaCallback({ code: 'abc', state }), 'https://shop.test/admin/social?connected=meta');
    assert.deepEqual(saved.map((s) => s.q.platform), ['facebook', 'instagram']);
    const fb = saved[0].u.$set;
    assert.equal(fb.externalId, '9001');
    assert.ok(!JSON.stringify(saved).includes('PAGE-TOKEN-1'), 'never stored in clear');
    assert.equal(box.unseal(fb.tokenSealed), 'PAGE-TOKEN-1');
    assert.equal(saved[1].u.$set.username, 'brynoxa1');
    // forged, wrong platform, or not the owner any more
    assert.equal(await social.metaCallback({ code: 'abc', state: 'x.y' }), 'https://shop.test/admin/social?connected=expired');
    assert.equal(await social.metaCallback({ code: 'abc', state: box.signState({ p: 'tiktok', u: OWNER }) }), 'https://shop.test/admin/social?connected=expired');
    role = 'marketing';
    assert.equal(await social.metaCallback({ code: 'abc', state: box.signState({ p: 'meta', u: OWNER }) }), 'https://shop.test/admin/social?connected=expired');
    assert.equal(await social.metaCallback({ error: 'access_denied', state }), 'https://shop.test/admin/social?connected=meta-cancelled');
  } finally {
    f.restore();
    User.findById = origFind;
    SocialAccount.findOneAndUpdate = origSave;
  }
});

test('overview: followers, posts with likes / comments, a daily snapshot; a broken account does not break the page', async () => {
  const social = require(dist('services/social.service.js'));
  const box = require(dist('utils/secretBox.js'));
  const { SocialAccount, SocialSnapshot } = require(dist('models/SocialAccount.js'));
  const orig = { find: SocialAccount.find, upd: SocialAccount.updateOne, snap: SocialSnapshot.updateOne, snapFind: SocialSnapshot.find };
  const snaps = [];
  SocialAccount.find = () => ({ lean: async () => [
    { _id: '1', platform: 'facebook', externalId: '9001', pageId: '9001', name: 'Brynoxa', tokenSealed: box.seal('PAGE') },
    { _id: '2', platform: 'instagram', externalId: '1784', pageId: '9001', name: 'brynoxa1', tokenSealed: box.seal('PAGE') },
  ] });
  SocialAccount.updateOne = async () => ({});
  SocialSnapshot.updateOne = async (q, u) => snaps.push({ ...q, ...u.$set });
  SocialSnapshot.find = () => ({ sort: () => ({ lean: async () => [] }) });
  const f = fakeFetch([
    [/\/9001\?/, { name: 'Brynoxa', followers_count: 1520 }],
    [/\/9001\/posts/, { data: [{ id: 'p1', message: 'New RTX laptops', created_time: '2026-11-10', reactions: { summary: { total_count: 42 } }, comments: { summary: { total_count: 5 } }, shares: { count: 3 } }] }],
    [/\/9001\/insights/, { error: { message: 'metric deprecated' } }],
    [/\/1784\?/, { error: { message: 'Error validating access token' } }],
  ]);
  try {
    const o = await social.overview();
    const fb = o.platforms.find((p) => p.platform === 'facebook');
    assert.equal(fb.followers, 1520);
    assert.deepEqual([fb.recent[0].likes, fb.recent[0].comments, fb.recent[0].shares], [42, 5, 3]);
    assert.equal(fb.reach28, undefined, 'insights are optional');
    const ig = o.platforms.find((p) => p.platform === 'instagram');
    assert.match(ig.error, /validating access token/);
    assert.equal(o.platforms.find((p) => p.platform === 'tiktok').connected, false);
    assert.equal(snaps.length, 1);
    assert.equal(snaps[0].platform, 'facebook');
    assert.equal(snaps[0].followers, 1520);
    assert.equal(o.setup.meta.configured, true);
    assert.ok(!JSON.stringify(o).includes('PAGE'), 'no key in the answer');
  } finally {
    f.restore();
    Object.assign(SocialAccount, { find: orig.find, updateOne: orig.upd });
    Object.assign(SocialSnapshot, { updateOne: orig.snap, find: orig.snapFind });
  }
});

test('replies go from the Page, only to a real customer id, as a response', async () => {
  const social = require(dist('services/social.service.js'));
  const box = require(dist('utils/secretBox.js'));
  const { SocialAccount } = require(dist('models/SocialAccount.js'));
  const orig = SocialAccount.findOne;
  SocialAccount.findOne = async () => ({ externalId: '9001', pageId: '9001', tokenSealed: box.seal('PAGE') });
  const f = fakeFetch([[/\/9001\/messages/, { recipient_id: '555', message_id: 'm1' }]]);
  try {
    await social.reply({ customerId: '5551234567', text: '  Salam, yes it is in stock ' });
    const body = JSON.parse(f.calls[0].init.body);
    assert.deepEqual(body, { recipient: { id: '5551234567' }, message: { text: 'Salam, yes it is in stock' }, messaging_type: 'RESPONSE' });
    await assert.rejects(() => social.reply({ customerId: '../me', text: 'x' }), /Unknown customer/);
    await assert.rejects(() => social.thread('a/b?x=1'), /Unknown conversation/);
  } finally {
    f.restore();
    SocialAccount.findOne = orig;
  }
});

test('rights, routes, live site, staff log, admin page', () => {
  const routes = read('backend/src/routes/social.routes.ts');
  assert.equal((routes.match(/requirePermission\('settings'\)/g) || []).length, 2, 'connect / disconnect: owner');
  assert.equal((routes.match(/requirePermission\('ads'\)/g) || []).length, 6, 'numbers, typed numbers and messages: owner + marketing');
  assert.ok(!/route === 'social'|startsWith\('social/.test(read('api/v1/admin.js')), 'admin routes reach Express');
  // the return from Meta / TikTok goes through the catch-all to Express
  const idx = read('api/index.js');
  const DEDICATED = idx.slice(idx.indexOf('const DEDICATED = ['), idx.indexOf('];', idx.indexOf('const DEDICATED = [')));
  assert.ok(!DEDICATED.includes('social'));
  const { describeStaffAction } = require(dist('utils/staffActions.js'));
  assert.equal(describeStaffAction('POST', 'admin/social/reply').action, 'Replied to a social media message');
  assert.equal(describeStaffAction('POST', 'admin/social/meta/connect').action, 'Connected a social media account');
  assert.equal(describeStaffAction('DELETE', 'admin/social/tiktok').action, 'Disconnected a social media account');
  const f = (p) => read(path.join('frontend/src', p));
  assert.ok(f('components/layout/AdminSidebar.tsx').includes("{ to: '/admin/social', label: 'Social media', icon: 'chat', group: 'Marketing' },"));
  assert.ok(f('lib/permissions.ts').includes("'/admin/social': 'ads',"));
  assert.ok(f('app/router.tsx').includes('<Route path="social" element={<S><AdminSocial /></S>} />'));
  assert.ok(read('backend/.env.example').includes('# META_APP_ID='));
});

test('without connection: numbers typed by staff (one row per platform and day), shown on the cards and the chart', async () => {
  const social = require(dist('services/social.service.js'));
  const { SocialAccount, SocialSnapshot } = require(dist('models/SocialAccount.js'));
  const { socialNumbersSchema } = require(dist('validators/schemas.js'));
  assert.ok(socialNumbersSchema.safeParse({ day: '2026-11-15', entries: [{ platform: 'instagram', followers: 3870, posts: 64 }] }).success);
  assert.ok(!socialNumbersSchema.safeParse({ day: '2026-11-15', entries: [{ platform: 'myspace', followers: 1 }] }).success);
  assert.ok(!socialNumbersSchema.safeParse({ day: '2026-11-15', entries: [{ platform: 'tiktok', followers: -4 }] }).success);
  assert.ok(!socialNumbersSchema.safeParse({ day: '2026-11-15', entries: [] }).success);

  const orig = { upd: SocialSnapshot.updateOne, find: SocialSnapshot.find, acc: SocialAccount.find, del: SocialSnapshot.deleteOne };
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
    SocialAccount.find = () => ({ lean: async () => [] });
    SocialSnapshot.find = () => ({ sort: () => ({ lean: async () => [
      { platform: 'instagram', day: day(20), followers: 3500, posts: 60, manual: true },
      { platform: 'instagram', day: day(1), followers: 3870, posts: 64, manual: true },
    ] }) });
    const o = await social.overview();
    const ig = o.platforms.find((p) => p.platform === 'instagram');
    assert.deepEqual([ig.connected, ig.followers, ig.posts, ig.typedOn], [false, 3870, 64, day(1)]);
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
    SocialAccount.find = orig.acc;
  }
  const page = read('frontend/src/pages/admin/Social.tsx');
  for (const href of ['https://business.facebook.com/latest/inbox/all', 'https://business.facebook.com/latest/insights', 'https://www.tiktok.com/tiktokstudio/analytics']) assert.ok(page.includes(href), href);
  assert.ok(!page.includes('Connect automatically') && !page.includes('function SetupGuide'), 'no developer-app guide on the page');
  // each account opens its own page: numbers, growth, and one click to its messages / posts / stats
  assert.ok(page.includes("onOpen={() => setParams({ platform: p.platform })}"));
  for (const href of ['https://business.facebook.com/latest/inbox/messenger', 'https://business.facebook.com/latest/inbox/instagram_direct', 'https://www.tiktok.com/tiktokstudio/content']) assert.ok(page.includes(href), href);
  assert.ok(page.includes('const growth = data.growth.filter((g) => g.platform === p.platform)'), 'its own chart');
});

test('followers are typed by hand: no Metricool link', () => {
  const page = read('frontend/src/pages/admin/Social.tsx');
  assert.ok(!/metricool/i.test(page));
  assert.ok(page.includes('Update my numbers'));
});
