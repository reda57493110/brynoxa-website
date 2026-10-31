// Help Center (/help) and the Help button: the three languages have the same guides, sections and
// answers (so /help#… links work everywhere), every link goes to a real store page or Terms section,
// every guide / help link used on other pages exists, the Help button picks the right guide for the
// page, and the search finds answers in all three languages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const src = path.join(root, 'frontend/src');
const load = async (rel: string) => import(pathToFileURL(path.join(src, rel)).href);

const { en } = await load('lib/help/en.ts');
const { fr } = await load('lib/help/fr.ts');
const { ar } = await load('lib/help/ar.ts');
const { searchHelp, helpLinks } = await load('lib/help/search.ts');
const { guideForPath } = await load('lib/help/context.ts');
const guides = { en, fr, ar };

const shape = (g: any) => ({
  guides: g.guides.map((q: any) => [q.id, q.icon, q.action.to, q.more, q.steps.map((s: any) => s.icon), Boolean(q.note)]),
  sections: g.sections.map((s: any) => [s.id, s.icon, s.topics.map((t: any) => [t.id, (t.links ?? []).map((l: any) => l.to)])]),
  faqs: g.faqs.map((f: any) => [f.id, (f.links ?? []).map((l: any) => l.to)]),
});

const guideIds = new Set(en.guides.map((g: any) => g.id));
const topicIds = new Set(en.sections.flatMap((s: any) => s.topics.map((t: any) => t.id)));
const anchorIds = new Set([...guideIds, ...topicIds, ...en.sections.map((s: any) => s.id), ...en.faqs.map((f: any) => f.id)]);

test('French and Arabic match the English structure and links', () => {
  assert.deepEqual(shape(fr), shape(en));
  assert.deepEqual(shape(ar), shape(en));
});

test('the five guides exist, are short, and point to an existing answer; ids are unique', () => {
  assert.deepEqual([...guideIds], ['order', 'pay', 'track', 'return', 'account']);
  for (const g of Object.values(guides) as any[]) {
    for (const q of g.guides) {
      assert.ok(q.steps.length >= 3 && q.steps.length <= 4, `${q.id}: 3 or 4 steps`);
      assert.ok(topicIds.has(q.more), `${q.id}: "more" points to a missing answer ${q.more}`);
    }
  }
  const ids = [...guideIds, ...en.sections.map((s: any) => s.id), ...topicIds, ...en.faqs.map((f: any) => f.id), 'faq', 'guides'];
  assert.equal(new Set(ids).size, ids.length);
});

// Store routes from the router (static paths), plus /services/<slug> and Terms anchors
const router = fs.readFileSync(path.join(src, 'app/router.tsx'), 'utf8');
const staticRoutes = new Set(
  [...router.matchAll(/path="([^"*:]+)"/g)].map((m) => '/' + m[1]).filter((p) => !p.startsWith('/admin'))
);
const site = fs.readFileSync(path.join(src, 'lib/site.ts'), 'utf8');
const serviceSlugs = [...site.matchAll(/slug: '([a-z-]+)'/g)].map((m) => m[1]);
const legal = fs.readFileSync(path.join(src, 'lib/legal.ts'), 'utf8');
const termsIds = new Set([...legal.slice(0, legal.indexOf('privacy: {')).matchAll(/id: '([a-z-]+)'/g)].map((m) => m[1]));

test('every guide link goes to a real page', () => {
  for (const [lang, g] of Object.entries(guides)) {
    for (const link of helpLinks(g)) {
      const [p, hash] = link.to.split('#');
      assert.ok(link.label.trim(), `${lang}: empty label for ${link.to}`);
      const known = staticRoutes.has(p) || (p.startsWith('/services/') && serviceSlugs.includes(p.slice('/services/'.length)));
      assert.ok(known, `${lang}: ${link.to} is not a store route`);
      if (hash) {
        assert.equal(p, '/terms', `${lang}: only Terms anchors are used (${link.to})`);
        assert.ok(termsIds.has(hash), `${lang}: Terms has no section #${hash}`);
      }
    }
  }
  assert.ok(staticRoutes.has('/help'), 'the /help route exists');
});

test('help links on other pages open existing guides or answers', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && !full.includes(`${path.sep}help${path.sep}`) && !e.name.startsWith('Help.')) files.push(full);
    }
  };
  walk(src);
  let found = 0;
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    const rel = path.relative(root, f);
    for (const m of text.matchAll(/<HelpLink guide="([a-z-]+)"/g)) {
      found++;
      assert.ok(guideIds.has(m[1]), `${rel}: no guide "${m[1]}"`);
    }
    for (const m of text.matchAll(/\/help#([a-z-]+)/g)) {
      found++;
      assert.ok(anchorIds.has(m[1]), `${rel}: /help#${m[1]} does not exist`);
    }
    const map = text.match(/SERVICE_HELP_GUIDE[^=]*= \{([^}]+)\}/);
    if (map) {
      for (const m of map[1].matchAll(/([a-z]+): ('([a-z-]+)'|null)/g)) {
        found++;
        assert.ok(m[2] === 'null' || guideIds.has(m[3]), `${rel}: service ${m[1]} → missing guide ${m[3]}`);
        assert.ok(serviceSlugs.length && site.includes(`id: '${m[1]}'`), `${rel}: unknown service ${m[1]}`);
      }
    }
  }
  assert.ok(found >= 10, 'contextual help links are in place');
});

test('the Help button opens the guide that fits the page', () => {
  assert.equal(guideForPath('/cart'), 'order');
  assert.equal(guideForPath('/checkout'), 'order');
  assert.equal(guideForPath('/product/rtx-4060'), 'order');
  assert.equal(guideForPath('/track-order'), 'track');
  assert.equal(guideForPath('/account/orders/BRX-20261029-ABC123'), 'track');
  assert.equal(guideForPath('/order-confirmation/BRX-20261029-ABC123'), 'track');
  assert.equal(guideForPath('/services/returns'), 'return');
  assert.equal(guideForPath('/services/warranty'), 'return');
  assert.equal(guideForPath('/services/cash-on-delivery'), 'pay');
  assert.equal(guideForPath('/account/settings'), 'account');
  assert.equal(guideForPath('/'), null);
  assert.equal(guideForPath('/shop'), null);
  assert.equal(guideForPath('/cart/'), 'order');
});

test('search finds answers in every language, ignores accents, and has an empty result', () => {
  const first = (g: any, q: string) => searchHelp(g, q).topics[0]?.topic.id;
  assert.equal(first(en, 'track my order'), 'track-order');
  assert.equal(first(fr, 'suivre commande'), 'track-order');
  assert.equal(first(ar, 'تتبع الطلب'), 'track-order');
  assert.ok(searchHelp(fr, 'GARANTIE').topics.some((r: any) => r.topic.id === 'warranty-claim'));
  assert.ok(searchHelp(fr, 'acompte').topics.some((r: any) => r.topic.id === 'deposit'));
  assert.ok(searchHelp(fr, 'remboursement').topics.some((r: any) => r.topic.id === 'refunds'));
  assert.ok(searchHelp(en, 'refund').topics.some((r: any) => r.topic.id === 'refunds'));
  assert.ok(searchHelp(ar, 'عربون').topics.some((r: any) => r.topic.id === 'deposit'));
  assert.ok(searchHelp(en, 'card').faqs.some((f: any) => f.id === 'faq-card'));
  assert.deepEqual(searchHelp(en, 'zzqqxx'), { topics: [], faqs: [] });
  assert.deepEqual(searchHelp(en, '  '), { topics: [], faqs: [] });
});

test('"How to order" follows the shopper: done steps ticked, the next move as the button', async () => {
  const { orderStepFor } = await load('lib/help/context.ts');
  assert.equal(orderStepFor('/shop', 0), 0, 'in the shop: find a product');
  assert.equal(orderStepFor('/product/hp-elite-book', 0), 1, 'on a product: add it');
  assert.equal(orderStepFor('/product/hp-elite-book', 1), 2, 'something in the cart: your details');
  assert.equal(orderStepFor('/checkout', 1), 2);
  assert.equal(orderStepFor('/contact', 0), undefined, 'elsewhere: no progress shown');
  // The steps the progress points at are the same in the three languages
  for (const g of [en, fr, ar]) assert.equal(g.guides.find((x: { id: string }) => x.id === 'order').steps.length, 4);
  const panel = fs.readFileSync(path.join(src, 'components/help/HelpPanel.tsx'), 'utf8');
  assert.match(panel, /to: '\/checkout'/);
  assert.match(fs.readFileSync(path.join(src, 'components/push/PushPrompt.tsx'), 'utf8'), /\|\| helpOpen\) return null/);
});
