// Shop pages on phones: public/preload.js starts the page's code, its first data and its main
// photo before the app runs. Checks what it asks for on each kind of page, that it leaves filtered
// views and other pages alone, and that the photo addresses are exactly the ones the page builds
// (src/lib/image.ts), so the browser reuses the download.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const script = fs.readFileSync(path.join(root, 'frontend/public/preload.js'), 'utf8');
const image = await import(pathToFileURL(path.join(root, 'frontend/src/lib/image.ts')).href);

type Link = { rel: string; href: string; as?: string; attrs: Record<string, string>; media?: string; referrerPolicy?: string };

/** Runs preload.js for an address; `answers` are the JSON replies of the fake server. */
async function run(url: string, answers: Record<string, unknown> = {}, chunks: Record<string, string[]> = {}) {
  const u = new URL(url, 'https://shop.test');
  const links: Link[] = [];
  const fetched: string[] = [];
  const window: Record<string, unknown> = {};
  const context = {
    window,
    location: { pathname: u.pathname, search: u.search },
    localStorage: { getItem: () => null },
    URL,
    document: {
      head: { appendChild: (l: Link) => links.push(l) },
      createElement: () => {
        const l = { attrs: {} } as Link & { setAttribute: (k: string, v: string) => void };
        l.setAttribute = (k, v) => (l.attrs[k] = v);
        return l;
      },
      getElementById: (id: string) => (id === 'route-chunks' ? { textContent: JSON.stringify(chunks) } : null),
    },
    fetch: async (f: string) => {
      fetched.push(f);
      const body = answers[f];
      return { ok: body !== undefined, json: async () => body };
    },
  };
  window.fetch = context.fetch;
  vm.runInNewContext(script, context);
  await new Promise((r) => setTimeout(r, 20));
  return { links, fetched, early: window.__brynoxaEarly as Record<string, unknown> | undefined };
}

test('shop: its code and first data start at once; filtered views load as usual', async () => {
  const r = await run('/shop', {}, { shop: ['assets/Shop-1.js', 'assets/Badge-2.js'] });
  assert.deepEqual(r.fetched, ['/api/v1/settings', '/api/v1/products?page=1&limit=12&sort=newest', '/api/v1/categories', '/api/v1/brands']);
  assert.deepEqual(r.links.filter((l) => l.rel === 'modulepreload').map((l) => l.href), ['/assets/Shop-1.js', '/assets/Badge-2.js']);
  const filtered = await run('/shop?category=laptops', {}, { shop: ['assets/Shop-1.js'] });
  assert.deepEqual(filtered.fetched, [], 'a filtered shop asks for other data');
  assert.equal(filtered.links.length, 1, 'but its code still starts early');
});

test('home, category and product pages (also in French / Arabic) ask for what they show first', async () => {
  assert.deepEqual((await run('/')).fetched, [
    '/api/v1/settings',
    '/api/v1/products?featured=true&inStock=true&limit=12',
    '/api/v1/products?featured=true&limit=4',
    '/api/v1/products?carousel=true&limit=12',
    '/api/v1/categories',
  ]);
  assert.equal((await run('/')).links.filter((l) => l.as === 'image').length, 2, 'home header photo (phone + computer)');
  assert.deepEqual((await run('/fr/category/laptops')).fetched, ['/api/v1/categories/laptops', '/api/v1/products?category=laptops&limit=24&sort=newest', '/api/v1/categories']);
  assert.deepEqual((await run('/ar/product/hp-840')).fetched, ['/api/v1/products/hp-840']);
  for (const other of ['/cart', '/checkout', '/account/orders', '/admin', '/help', '/product/a/b']) {
    assert.deepEqual((await run(other)).fetched, [], other);
  }
});

const cloud = 'https://res.cloudinary.com/demo/image/upload/v1/brynoxa/p.jpg';

test('shop: the picked product and its photo follow the settings, with the page’s exact photo address', async () => {
  const id = 'a'.repeat(24);
  const r = await run('/shop', {
    '/api/v1/settings': { data: { pageHeroProducts: { shop: id } } },
    [`/api/v1/products/compare?ids=${id}`]: { data: [{ stock: 3, images: [{ url: 'x' }, { url: cloud, isPrimary: true }] }] },
  });
  assert.ok(r.fetched.includes(`/api/v1/products/compare?ids=${id}`));
  const p = r.links.find((l) => l.as === 'image')!;
  assert.equal(p.href, image.sizedImageUrl(cloud, 1280));
  assert.equal(p.attrs.imagesrcset, image.imageSrcSet(cloud, [640, 960, 1280, 1600]));
  assert.equal(p.referrerPolicy, 'no-referrer');
  const sold = await run('/shop', {
    '/api/v1/settings': { data: { pageHeroProducts: { shop: id } } },
    [`/api/v1/products/compare?ids=${id}`]: { data: [{ stock: 0, images: [{ url: cloud }] }] },
  });
  assert.equal(sold.links.filter((l) => l.as === 'image').length, 0, 'a sold-out pick is replaced by the page, so no photo');
});

test('product: its first photo, same addresses as the gallery for every kind of photo', async () => {
  const photos = [cloud, 'https://images.unsplash.com/photo-123?auto=format&fit=crop&w=1600&q=80', '/api/v1/images/' + 'b'.repeat(24)];
  for (const url of photos) {
    const r = await run('/product/x', { '/api/v1/products/x': { data: { images: [{ url }, { url: 'second' }] } } });
    const p = r.links.find((l) => l.as === 'image')!;
    assert.equal(p.href, image.sizedImageUrl(url, 1200), url);
    assert.equal(p.attrs.imagesrcset, image.imageSrcSet(url, [480, 768, 1080, 1440]), url);
  }
});

test('the app uses an early answer once, by address, within 20 s', () => {
  const client = fs.readFileSync(path.join(root, 'frontend/src/api/client.ts'), 'utf8');
  assert.match(client, /const key = api\.getUri\(config\)/);
  assert.match(client, /delete early\[key\]/);
  assert.match(client, /EARLY_MAX_AGE_MS = 20_000/);
  const html = fs.readFileSync(path.join(root, 'frontend/index.html'), 'utf8');
  assert.match(html, /<script src="\/preload\.js"><\/script>/);
});

test('Cloudinary photos are never enlarged past the original (smaller downloads for small photos)', () => {
  assert.equal(
    image.sizedImageUrl(cloud, 768),
    'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_768/v1/brynoxa/p.jpg'
  );
});

// The animation code loads after the first paint (LazyMotion): anything that starts hidden with it
// (initial opacity 0) stays invisible until that download ends — product cards waited ~2 s on phones.
test('product cards and home category tiles show at once (CSS rise, not the late animation code)', () => {
  const src = (p: string) => fs.readFileSync(path.join(root, 'frontend/src', p), 'utf8');
  const grid = src('components/product/ProductGrid.tsx');
  assert.doesNotMatch(grid, /framer-motion|<m\.|initial=/);
  assert.match(grid, /data-rise="card"/);
  assert.match(grid, /<ProductCard product=\{p\} eager=\{i < 4\} \/>/, 'first row photos download at once');
  assert.match(src('components/product/ProductCard.tsx'), /loading=\{spotlight \|\| eager \? 'eager' : 'lazy'\}/);
  const home = src('pages/store/Home.tsx');
  const tiles = home.slice(home.indexOf('categoryList.map('), home.indexOf('Closing CTA'));
  assert.doesNotMatch(tiles, /<m\.div|initial=/);
  assert.match(tiles, /data-rise="card"/);
  assert.match(src('index.css'), /\[data-rise\] \{\s+animation: hero-rise/);
  // Product page (photos, price, Add to cart) and the shop / category headers: same rule
  for (const f of ['pages/store/ProductDetail.tsx', 'components/layout/StoreHero.tsx']) {
    const code = src(f);
    assert.doesNotMatch(code, /framer-motion|<m\.|opacity: 0/, f);
    assert.match(code, /'data-rise': 'card'/, f);
  }
});
