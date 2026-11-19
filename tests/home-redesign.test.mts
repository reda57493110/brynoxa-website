// Home page rebuilt from zero (Nov 2026) in the style of the big Moroccan PC shops, in Brynoxa's
// colours: category menu + deals banner + photo tiles, promises strip, title + round categories,
// Deals of the moment, Our selection (tabs), Signature banner, products by category, budgets,
// setups band, brands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');

test('order of the sections; one main title', () => {
  const home = src('pages/store/Home.tsx');
  const marks = ['<HomeHero', '<HomeTrustBar />', '<HomeIntro', '<HomeDealsBlock', '<HomeSelection', '<HomeSignatureBanner', '<HomeCategoryTabs', '<HomeBudgetCards', '<HomeSetupsBand />', '<HomeBrands'];
  const pos = marks.map((m) => home.indexOf(m));
  assert.ok(pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1])), marks.map((m, i) => `${m}: ${pos[i]}`).join('\n'));
  const all = ['components/home/HomeHero.tsx', 'components/home/HomeBlocks.tsx', 'components/home/HomeHeroSlider.tsx', 'pages/store/Home.tsx'].map(src).join('\n');
  assert.equal((all.match(/<h1/g) || []).length, 1, 'one main title');
  assert.ok(src('components/home/HomeBlocks.tsx').includes('<h1 id="home-hero-heading"'));
});

test('admin choices still feed the page: deals banner, top picks, deals, new arrivals, Signature, budgets', () => {
  const home = src('pages/store/Home.tsx');
  for (const k of [
    'deals={deals.products}',
    'useHomeRows([...deals.products, ...(featured.data ?? []), ...(carousel.data ?? [])])',
    'const topPicks = unique([...(featured.data ?? []), ...(carousel.data ?? [])])',
    'picks={topPicks}',
    'newArrivals={rows.newArrivals}',
    '<HomeDealsBlock products={rows.deals} />',
    '<HomeSignatureBanner products={rows.signature} />',
    '<HomeBudgetCards budgets={rows.budgets} />',
  ]) assert.ok(home.includes(k), k);
  assert.ok(home.includes('(p, i, all) => all.findIndex((q) => q._id === p._id) === i'), 'no product twice');
});

test('top of the page: category menu (chips on phones), the banner, two photo tiles', () => {
  const hero = src('components/home/HomeHero.tsx');
  assert.ok(hero.includes("t('home.allCategories')"));
  assert.ok(hero.includes('lg:grid-cols-[15rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)_16rem]'));
  assert.ok(hero.includes('to="/shop?onSale=true"') && hero.includes('to="/setups"'));
  const s = src('components/home/HomeHeroSlider.tsx');
  assert.match(s, /export const SLIDE_MS = 6000/);
  for (const k of ['onMouseEnter={() => setPaused(true)}', 'onFocusCapture={() => setPaused(true)}', 'onTouchEnd=', 'role="tablist"', 'inert={!active}']) assert.ok(s.includes(k), k);
});

test('product cards: sticker, photo, brand, name, specs, stock, price, a cart button; rows never move by themselves', () => {
  const card = src('components/home/HomeShopCard.tsx');
  for (const k of ['useAddToCart(product)', 'keySpecs(product, locale, 3)', '<StockLine', "t('home.badgeNew')", "t('home.badgeTop')", 'aria-label={`${t(\'common.addToCart\')}: ${product.name}`}']) assert.ok(card.includes(k), k);
  const shelf = src('components/home/HomeShelf.tsx');
  assert.ok(shelf.includes('snap-x snap-mandatory'), 'swipe / scroll by hand');
  assert.doesNotMatch(shelf, /setInterval|requestAnimationFrame/, 'no automatic movement');
  assert.ok(shelf.includes("t('home.scrollPrev')") && shelf.includes("t('home.scrollNext')"));
});

test('Our selection: three tabs; Best sellers loads only when opened', () => {
  const b = src('components/home/HomeBlocks.tsx');
  assert.ok(b.includes("productsApi.list({ sort: 'popular', inStock: true, limit: 10 })"));
  assert.ok(b.includes("enabled: tab === 'best'"));
  assert.ok(b.includes('role="tablist" aria-label={t(\'home.selectionTitle\')}'));
});

test('products by category: one request per opened tab, in stock only', () => {
  const b = src('components/home/HomeBlocks.tsx');
  assert.ok(b.includes('productsApi.list({ category: active!.slug, inStock: true, limit: 12 })'));
  assert.ok(src('pages/store/Home.tsx').includes('<HomeCategoryTabs categories={homeCategories.slice(0, 6)} />'));
});

test('brands: only brands of products on the page (so each has stock), three at least', () => {
  const b = src('components/home/HomeBlocks.tsx');
  assert.ok(b.includes('if (brands.length < 3) return null'));
  assert.ok(b.includes('to={`/shop?brand=${encodeURIComponent(b.slug)}`}'));
});

test('promises strip: cash on delivery, delivery, returns, WhatsApp; no warranty length promised', () => {
  const bar = src('components/home/HomeTrustBar.tsx');
  for (const to of ["to: '/services/cash-on-delivery'", "to: '/services/home-delivery'", "to: '/services/returns'", 'href: whatsappHref()']) assert.ok(bar.includes(to), to);
  assert.doesNotMatch(bar.replace(/\/\*[\s\S]*?\*\//g, ''), /warranty/i, 'the product page says each product own warranty');
});

test('texts in the three languages', () => {
  const keys = [
    'trustLabel', 'trustCodTitle', 'trustCodBody', 'trustDeliveryTitle', 'trustDeliveryBody', 'trustReturnsTitle', 'trustReturnsBody', 'trustHelpTitle', 'trustHelpBody',
    'prevDeal', 'nextDeal', 'allCategories', 'promoSetupTitle', 'dealsMomentTitle', 'selectionTitle', 'tabPicks', 'tabNew', 'tabBest', 'badgeNew', 'badgeTop',
    'catProductsTitle', 'catSeeAll', 'setupsBandTitle', 'setupsBandBody', 'brandsTitle', 'scrollPrev', 'scrollNext',
  ];
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of keys) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});

test('the old home pieces are gone', () => {
  for (const f of ['HeroBackdrop', 'HomeDeals', 'HomeBudget', 'HomeSignature', 'HomeSetups', 'HomeProductRow']) {
    assert.ok(!fs.existsSync(path.join(root, `frontend/src/components/home/${f}.tsx`)), f);
  }
  assert.doesNotMatch(src('index.css'), /hero-showroom|hero-band/);
  assert.doesNotMatch(src('components/home/HomeSpotlight.tsx'), /HomeSpotlightCard|HomeSpotlightSkeleton/);
});

test('cards: another photo on hover, compare button, "Free delivery" by the same rule as the cart', () => {
  const card = src('components/home/HomeShopCard.tsx');
  assert.ok(card.includes("hover && 'sm:group-hover:opacity-0'"), 'second photo only on computers');
  assert.ok(card.includes('aria-pressed={compared}'));
  assert.ok(card.includes('deliveryAlwaysIncluded(s) || (s.freeShippingMin > 0 && price >= s.freeShippingMin)'));
  for (const l of ['en', 'fr', 'ar']) assert.ok(src(`i18n/${l}.ts`).includes('    freeDelivery: \''), l);
});

test('sections rise in on scroll, never hidden without the observer, for people who ask for less motion, or in print', () => {
  const home = src('pages/store/Home.tsx');
  assert.ok(home.includes("if (typeof IntersectionObserver === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return"));
  assert.ok(home.includes(`'[data-reveal=""], [data-reveal="wait"]'`), 'still-waiting sections are watched again (React restarts the effect in development)');
  assert.ok(home.includes("el.getBoundingClientRect().top > window.innerHeight ? 'wait' : 'in'"), 'only sections below the screen wait');
  const css = src('index.css');
  assert.match(css, /\[data-reveal='wait'\] \{\s+opacity: 0;/);
  assert.match(css, /@media print \{\s+\[data-reveal='wait'\]/);
});

test('help band: WhatsApp with the question written in, and the shop phone from Settings', () => {
  const b = src('components/home/HomeBlocks.tsx');
  assert.ok(b.includes("href={whatsappHref(t('home.helpBandMessage'))}"));
  assert.ok(b.includes('href={CONTACT.phone.href}'));
  assert.ok(src('pages/store/Home.tsx').includes('<HomeHelpBand />'));
  for (const l of ['en', 'fr', 'ar']) {
    const t = src(`i18n/${l}.ts`);
    for (const k of ['helpBandTitle', 'helpBandBody', 'helpBandWhatsapp', 'helpBandMessage', 'dealsSaveUpTo']) assert.ok(t.includes(`    ${k}: '`), `${l}: ${k}`);
  }
});

test('banner: a small photo and the price of each deal under it (computers)', () => {
  const s = src('components/home/HomeHeroSlider.tsx');
  assert.ok(s.includes("sizedImageUrl(primaryImage(p), 120)"));
  assert.ok(s.includes('{formatCurrency(p.price)}</span>'));
});
