// Every shop page address answers 200 (not 404) on the live site: vercel.json must list each
// top-level page of the router, or Google sees "not found" even though visitors see the page.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./_helpers.cjs');

test('every top-level shop page of the router is served by the app (200) in all 3 languages', () => {
  const router = fs.readFileSync(path.join(ROOT, 'frontend/src/app/router.tsx'), 'utf8');
  const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  const rules = vercel.rewrites.filter((r) => r.destination === '/index.html').map((r) => new RegExp(`^${r.source.replace(/^\//, '/')}$`));
  // Shop and sign-in pages (from the shop layout down to the admin section)
  const store = router.slice(router.indexOf('element={<StoreLayout />}>'), router.indexOf('path="admin"'));
  const pages = [...new Set([...store.matchAll(/path="([a-z][a-z-]*)/g)].map((m) => m[1]))];
  assert.ok(pages.includes('setups') && pages.includes('shop'), 'found the shop pages');
  for (const p of pages) {
    for (const prefix of ['', '/fr', '/ar']) {
      const url = `${prefix}/${p}`;
      assert.ok(rules.some((rx) => rx.test(url)), `${url} is not served by the app (404 for Google)`);
    }
  }
  assert.ok(rules.some((rx) => rx.test('/setups/gaming')), 'sub-pages too');
});
