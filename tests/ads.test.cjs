// Admin → Ads & social media: campaigns with a tracking link, money spent (saved as "ads"
// expenses, so Profit counts it), and the orders / revenue each link brings.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { dist, api, ROOT, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('utm values are cleaned; an order keeps them only when there is a source or a campaign', () => {
  const { cleanUtm, cleanUtmValue, campaignCode } = require(dist('utils/adTracking.js'));
  assert.equal(cleanUtmValue('  Black Friday!! '), 'black-friday');
  assert.equal(cleanUtmValue('<script>'), 'script');
  assert.equal(cleanUtmValue('x'.repeat(200)).length, 64);
  assert.equal(cleanUtmValue(42), undefined);
  assert.deepEqual(cleanUtm({ source: 'Facebook', medium: 'paid', campaign: 'Gaming PCs', extra: 'x' }), {
    source: 'facebook',
    medium: 'paid',
    campaign: 'gaming-pcs',
  });
  assert.equal(cleanUtm({ medium: 'paid' }), undefined, 'a medium alone says nothing');
  assert.equal(cleanUtm(null), undefined);
  assert.equal(campaignCode('Soldes été — PC Gamer 2026'), 'soldes-ete-pc-gamer-2026');
  assert.equal(campaignCode('عرض'), 'campaign', 'a name with no latin letter still gets a code');
});

test('results: cost per order and return per 1 DH, nothing divided by zero', () => {
  const { adResults } = require(dist('utils/adTracking.js'));
  assert.deepEqual(adResults({ spent: 1000, orders: 4, revenue: 12000 }), { spent: 1000, orders: 4, revenue: 12000, costPerOrder: 250, roas: 12 });
  assert.deepEqual(adResults({ spent: 0, orders: 3, revenue: 900 }), { spent: 0, orders: 3, revenue: 900, costPerOrder: 0, roas: null }, 'free post');
  assert.equal(adResults({ spent: 500, orders: 0, revenue: 0 }).costPerOrder, null, 'no order yet');
  assert.equal(adResults({ spent: 300, orders: 0, revenue: 0 }).roas, 0);
});

test('the order form accepts the tracking values; both order paths save them on the order', () => {
  const { createOrderSchema, adCampaignSchema, adSpendSchema, forUpdate } = require(dist('validators/schemas.js'));
  const base = { items: [{ productId: 'a'.repeat(24), qty: 1 }], shippingAddress: { fullName: 'A B', line1: 'Rue 1', city: 'Rabat', state: 'Rabat', postalCode: '10000', country: 'MA', phone: '0612345678' } };
  const parsed = createOrderSchema.safeParse({ ...base, utm: { source: 'tiktok', campaign: 'x' } });
  if (parsed.success) assert.deepEqual(parsed.data.utm, { source: 'tiktok', campaign: 'x' });
  assert.ok(!createOrderSchema.safeParse({ ...base, utm: { source: 'x'.repeat(500) } }).success, 'too long refused');

  assert.ok(read('backend/src/services/order.service.ts').includes('marketing: cleanUtm(input.utm),'));
  assert.ok(read('backend/src/controllers/order.controller.ts').includes('utm: req.body.utm,'), 'Express');
  assert.ok(read('api/v1/orders.js').includes('utm: body.utm,'), 'live site');
  assert.ok(read('backend/src/models/Order.ts').includes("orderSchema.index({ 'marketing.campaign': 1, createdAt: -1 }, { sparse: true });"));

  // Campaign form: the link can only open a page of this shop
  const ok = { name: 'Gaming PCs', platform: 'facebook', kind: 'paid', landingPath: '/products/rtx' };
  assert.ok(adCampaignSchema.safeParse(ok).success);
  for (const bad of ['//evil.test', 'https://evil.test', 'shop', '/a b']) {
    assert.ok(!adCampaignSchema.safeParse({ ...ok, landingPath: bad }).success, bad);
  }
  assert.ok(!adCampaignSchema.safeParse({ ...ok, platform: 'myspace' }).success);
  assert.equal(forUpdate(adCampaignSchema).parse({ isActive: false }).kind, undefined, 'an edit never resets the type');
  assert.ok(adSpendSchema.safeParse({ amount: 250, day: '2026-11-13' }).success);
  assert.ok(!adSpendSchema.safeParse({ amount: 0, day: '2026-11-13' }).success);
  assert.ok(!adSpendSchema.safeParse({ amount: 10, day: '13/11/2026' }).success);
});

test('permission "ads": owner and Marketing; mirrored in the admin; logged in staff activity', () => {
  const { hasPermission } = require(dist('permissions.js'));
  assert.ok(hasPermission('admin', 'ads'));
  assert.ok(hasPermission('marketing', 'ads'));
  for (const r of ['orders', 'catalog', 'support']) assert.ok(!hasPermission(r, 'ads'), r);
  const front = read('frontend/src/lib/permissions.ts');
  assert.ok(front.includes("marketing: ['coupons', 'reviews', 'push', 'ads'],") && front.includes("'/admin/ads': 'ads',"));

  const { describeStaffAction } = require(dist('utils/staffActions.js'));
  const id = 'b'.repeat(24);
  assert.equal(describeStaffAction('POST', `admin/ads/${id}/spend`).action, 'Added ad spending');
  assert.equal(describeStaffAction('POST', 'admin/ads').action, 'Added an ad campaign');
  assert.equal(describeStaffAction('DELETE', `admin/ads/${id}`).action, 'Deleted an ad campaign');
});

test('live site: /api/v1/admin/ads… reaches Express (no fast handler takes it)', () => {
  const admin = read('api/v1/admin.js');
  assert.ok(!/route === 'ads'|startsWith\('ads/.test(admin));
  assert.ok(admin.includes('await delegateToExpress(req, res, route, query);'));
  assert.ok(read('vercel.json').includes('"destination": "/api/v1/admin?__route=$1"'));
  const routes = read('backend/src/routes/ads.routes.ts');
  for (const r of ["'/admin/ads'", "'/admin/ads/:id'", "'/admin/ads/:id/spend'", "'/admin/ads/:id/spend/:spendId'"]) assert.ok(routes.includes(r), r);
  assert.ok(routes.includes("const staff = [requireAuth, requirePermission('ads')];"));
  assert.ok(read('backend/src/routes/index.ts').includes('router.use(adsRoutes);'));
});

test('overview: spending, orders and revenue per campaign and platform; loose ad expenses counted', async () => {
  const { AdCampaign } = require(dist('models/AdCampaign.js'));
  const { Expense } = require(dist('models/Expense.js'));
  const { Order } = require(dist('models/Order.js'));
  const ads = require(dist('services/ads.service.js'));
  const fb = { _id: 'c'.repeat(24), name: 'FB PCs', code: 'fb-pcs', platform: 'facebook', kind: 'paid', landingPath: '/', budget: 1000, isActive: true, createdAt: new Date() };
  const tt = { _id: 'd'.repeat(24), name: 'TikTok video', code: 'tt-video', platform: 'tiktok', kind: 'organic', landingPath: '/shop', isActive: false, createdAt: new Date() };
  const orig = { find: AdCampaign.find, ea: Expense.aggregate, oa: Order.aggregate };
  let orderMatch;
  AdCampaign.find = () => ({ sort: () => ({ lean: async () => [fb, tt] }) });
  Expense.aggregate = async () => [
    { _id: fb._id, spent: 1200, entries: 2 },
    { _id: null, spent: 300, entries: 1 },
  ];
  Order.aggregate = async (pipeline) => {
    orderMatch = pipeline[0].$match;
    return [
      { _id: 'fb-pcs', source: 'facebook', orders: 4, revenue: 24000, delivered: 3 },
      { _id: 'tt-video', source: 'tiktok', orders: 2, revenue: 9000, delivered: 1 },
      { _id: 'old-deleted', source: 'instagram', orders: 1, revenue: 5000, delivered: 1 },
    ];
  };
  try {
    const o = await ads.adsOverview(30);
    assert.deepEqual(orderMatch.orderStatus, { $nin: ['cancelled', 'returned'] });
    assert.ok(orderMatch.createdAt.$gte instanceof Date);
    const f = o.campaigns.find((c) => c.code === 'fb-pcs');
    assert.equal(f.spent, 1200);
    assert.equal(f.costPerOrder, 300);
    assert.equal(f.roas, 20);
    assert.equal(f.budgetLeft, -200, 'over budget');
    assert.equal(f.trackingQuery, 'utm_source=facebook&utm_medium=paid&utm_campaign=fb-pcs');
    const t = o.campaigns.find((c) => c.code === 'tt-video');
    assert.equal(t.trackingQuery, 'utm_source=tiktok&utm_medium=social&utm_campaign=tt-video');
    assert.equal(t.roas, null, 'free post: nothing spent');
    assert.equal(o.totals.spent, 1500, 'ads expenses added in Profit count too');
    assert.equal(o.otherSpent, 300);
    assert.equal(o.totals.orders, 7);
    assert.equal(o.totals.revenue, 38000);
    assert.equal(o.otherLinks.orders, 1);
    assert.deepEqual(o.platforms.map((p) => p.platform), ['facebook', 'instagram', 'tiktok']);
    assert.equal(o.platforms.find((p) => p.platform === 'instagram').orders, 1, 'link of a deleted campaign');
    const all = await (async () => {
      await ads.adsOverview(0);
      return orderMatch;
    })();
    assert.equal(all.createdAt, undefined, 'since the start: no date limit');
  } finally {
    AdCampaign.find = orig.find;
    Expense.aggregate = orig.ea;
    Order.aggregate = orig.oa;
  }
});

test('spending is an "ads" expense of the campaign (so Profit counts it); deleting a campaign keeps it', async () => {
  const { AdCampaign } = require(dist('models/AdCampaign.js'));
  const { Expense } = require(dist('models/Expense.js'));
  const ads = require(dist('services/ads.service.js'));
  const id = 'e'.repeat(24);
  const orig = { findById: AdCampaign.findById, deleteOne: AdCampaign.deleteOne, create: Expense.create, updateMany: Expense.updateMany };
  let created, unlinked;
  AdCampaign.findById = () => ({ lean: async () => ({ _id: id, name: 'Insta reels' }) });
  AdCampaign.deleteOne = async () => ({ deletedCount: 1 });
  Expense.create = async (doc) => {
    created = doc;
    return { _id: 'f'.repeat(24) };
  };
  Expense.updateMany = async (q, u) => {
    unlinked = { q, u };
  };
  try {
    await ads.addSpend(id, { amount: 149.999, day: '2026-11-10', note: ' card ' }, undefined);
    assert.equal(created.category, 'ads');
    assert.equal(created.label, 'Ad: Insta reels');
    assert.equal(created.amount, 150);
    assert.equal(created.campaign, id);
    assert.equal(created.note, 'card');
    assert.equal(created.date.toISOString(), '2026-11-10T12:00:00.000Z');
    await ads.deleteCampaign(id);
    assert.deepEqual(unlinked, { q: { campaign: id }, u: { $unset: { campaign: '' } } });
    await assert.rejects(() => ads.addSpend('nope', { amount: 1, day: '2026-11-10' }), /Campaign not found/);
  } finally {
    Object.assign(AdCampaign, { findById: orig.findById, deleteOne: orig.deleteOne });
    Object.assign(Expense, { create: orig.create, updateMany: orig.updateMany });
  }
});

test('admin: page, menu entry under Marketing, search; the shop remembers the link and sends it with the order', () => {
  const f = (p) => read(path.join('frontend/src', p));
  assert.ok(f('components/layout/AdminSidebar.tsx').includes("{ to: '/admin/ads', label: 'Ads & social media', icon: 'megaphone', group: 'Marketing' },"));
  assert.ok(f('app/router.tsx').includes('<Route path="ads" element={<S><AdminAds /></S>} />'));
  assert.ok(f('lib/adminSearch.ts').includes("to: '/admin/ads'"));
  assert.ok(f('components/analytics/AnalyticsListener.tsx').includes("if (!location.pathname.includes('/admin')) captureUtm(location.search)"));
  assert.ok(f('pages/store/Checkout.tsx').includes('utm: readUtm(),'));
  // Server and shop clean values the same way and know the same platforms
  const back = read('backend/src/utils/adTracking.ts');
  const front = f('lib/adTracking.ts');
  const platforms = (s) => s.match(/AD_PLATFORMS = \[[^\]]+\]/)[0];
  assert.equal(platforms(front), platforms(back));
  assert.ok(back.includes("export const UTM_MEDIUM: Record<AdKind, string> = { paid: 'paid', organic: 'social' };"));
  assert.ok(front.includes("export const UTM_MEDIUM: Record<AdKind, string> = { paid: 'paid', organic: 'social' }"));
  assert.ok(back.includes('export const UTM_KEEP_DAYS = 30;') && front.includes('export const UTM_KEEP_DAYS = 30'));
});
