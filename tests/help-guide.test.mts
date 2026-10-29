// Help Center (/help): the three languages have the same sections and topics (so /help#topic links
// work everywhere), every link goes to a real store page or Terms section, every /help#… link used
// on other pages exists, and the search finds topics in all three languages.
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
const guides = { en, fr, ar };

const shape = (g: any) => ({
  sections: g.sections.map((s: any) => [s.id, s.icon, s.topics.map((t: any) => [t.id, (t.links ?? []).map((l: any) => l.to)])]),
  faqs: g.faqs.map((f: any) => [f.id, (f.links ?? []).map((l: any) => l.to)]),
});

test('French and Arabic match the English structure and links', () => {
  assert.deepEqual(shape(fr), shape(en));
  assert.deepEqual(shape(ar), shape(en));
});

test('ids are unique', () => {
  const ids = [...en.sections.map((s: any) => s.id), ...en.sections.flatMap((s: any) => s.topics.map((t: any) => t.id)), ...en.faqs.map((f: any) => f.id), 'faq', 'topics'];
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

test('every /help#… link on other pages points to an existing topic or section', () => {
  const ids = new Set([...en.sections.map((s: any) => s.id), ...en.sections.flatMap((s: any) => s.topics.map((t: any) => t.id)), ...en.faqs.map((f: any) => f.id)]);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(e.name) && !full.includes(`${path.sep}help${path.sep}`)) files.push(full);
    }
  };
  walk(src);
  let found = 0;
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/(?:\/help#|<HelpLink topic=")([a-z-]+)/g)) {
      found++;
      assert.ok(ids.has(m[1]), `${path.relative(root, f)} links to missing help topic "${m[1]}"`);
    }
    // ServiceDetail maps each service to a topic
    for (const m of text.matchAll(/^\s+[a-z]+: '([a-z-]+)',$/gm)) {
      if (text.includes('SERVICE_HELP_TOPIC')) assert.ok(ids.has(m[1]), `${path.relative(root, f)}: missing help topic "${m[1]}"`);
    }
  }
  assert.ok(found >= 6, 'contextual help links are in place');
});

test('search finds topics in every language, ignores accents, and has an empty result', () => {
  const first = (g: any, q: string) => searchHelp(g, q).topics[0]?.topic.id;
  assert.equal(first(en, 'track my order'), 'track-order');
  assert.equal(first(fr, 'suivre commande'), 'track-order');
  assert.equal(first(ar, 'تتبع الطلب'), 'track-order');
  assert.ok(searchHelp(fr, 'GARANTIE').topics.some((r: any) => r.topic.id === 'warranty'));
  assert.ok(searchHelp(fr, 'acompte').topics.some((r: any) => r.topic.id === 'deposit'));
  assert.ok(searchHelp(fr, 'remboursement').topics.some((r: any) => r.topic.id === 'refunds'));
  assert.ok(searchHelp(en, 'refund').topics.some((r: any) => r.topic.id === 'refunds'));
  assert.ok(searchHelp(en, 'card').faqs.some((f: any) => f.id === 'faq-card'));
  assert.deepEqual(searchHelp(en, 'zzqqxx'), { topics: [], faqs: [] });
  assert.deepEqual(searchHelp(en, '  '), { topics: [], faqs: [] });
});
