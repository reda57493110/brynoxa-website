// Home page redesign (Nov 2026): deals banner + Brynoxa card, promises strip, category tiles,
// "shelves" (dark panel + carousel) — ideas from Moroccan PC shops, in Brynoxa's colours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');

test('order: banner + headline, promises, categories, setups, top picks, Signature, budget, deals, new arrivals', () => {
  const home = src('pages/store/Home.tsx');
  const marks = ['<HomeHeroSlider products={deals.products} />', 'id="home-hero-heading"', '<HomeTrustBar />', '{/* Categories:', '<HomeSetups />', 'id="featured"', '<HomeSignature products={rows.signature} />', '<HomeBudget budgets', 'id="deals"', 'id="new-arrivals"'];
  const pos = marks.map((m) => home.indexOf(m));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), marks.map((m, i) => `${m}: ${pos[i]}`).join('\n'));
  assert.equal((home.match(/<h1/g) || []).length, 1, 'one main title');
});

test('banner: the home deals rotate (6 s), pause on hover / focus, swipe, bars and arrows to pick one', () => {
  const s = src('components/home/HomeHeroSlider.tsx');
  assert.match(s, /export const SLIDE_MS = 6000/);
  for (const k of ['onMouseEnter={() => setPaused(true)}', 'onFocusCapture={() => setPaused(true)}', 'onTouchEnd=', 'role="tablist"', "t('home.prevDeal')", "t('home.nextDeal')", 'inert={!active}']) assert.ok(s.includes(k), k);
  assert.ok(s.includes("loading={eager ? 'eager' : 'lazy'}"), 'only the first photo downloads at once');
});

test('promises strip: cash on delivery, delivery, returns, WhatsApp — no warranty length promised', () => {
  const bar = src('components/home/HomeTrustBar.tsx');
  for (const to of ["to: '/services/cash-on-delivery'", "to: '/services/home-delivery'", "to: '/services/returns'", 'href: whatsappHref()']) assert.ok(bar.includes(to), to);
  assert.doesNotMatch(bar.replace(/\/\*[\s\S]*?\*\//g, ''), /warranty/i, 'the product page says each product own warranty');
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['trustLabel', 'trustCodTitle', 'trustCodBody', 'trustDeliveryTitle', 'trustDeliveryBody', 'trustReturnsTitle', 'trustReturnsBody', 'trustHelpTitle', 'trustHelpBody', 'prevDeal', 'nextDeal', 'picksCount']) {
      assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
    }
  }
});

test('shelves: dark Brynoxa panel beside the carousel; top picks = featured then carousel products, each once', () => {
  const row = src('components/home/HomeProductRow.tsx');
  assert.ok(row.includes("lg:grid-cols-[17rem_minmax(0,1fr)]"));
  assert.ok(row.includes("tone: 'deals' | 'new' | 'featured'"));
  const home = src('pages/store/Home.tsx');
  assert.ok(home.includes('all.findIndex((q) => q._id === p._id) === i'), 'no product twice');
  assert.ok(home.includes('products={topPicks}\n          min={1}'), 'top picks show from one product');
});

test('the old full-screen header is gone (its photo files, styles and components)', () => {
  for (const f of ['components/home/HeroBackdrop.tsx', 'components/home/HomeDeals.tsx']) assert.ok(!fs.existsSync(path.join(root, 'frontend/src', f)), f);
  assert.doesNotMatch(src('index.css'), /hero-showroom|hero-band/);
  assert.doesNotMatch(src('components/home/HomeSpotlight.tsx'), /HomeSpotlightCard|HomeSpotlightSkeleton/);
});
