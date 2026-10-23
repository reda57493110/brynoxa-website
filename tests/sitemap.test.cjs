// Sitemap: every page in English, French (/fr) and Arabic (/ar), each listing the others (hreflang).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, fakeModule, setTestEnv } = require('./_helpers.cjs');
setTestEnv({ CLIENT_URL: 'https://shop.test' });

fakeModule(api('_lib/mongo.js'), { connectMongo: async () => { throw new Error('no database in tests'); } });
const handler = require(api('sitemap.js'));

test('each page appears three times with language alternates', async () => {
  let body = '';
  const res = { statusCode: 0, setHeader() {}, end(b) { body = b || ''; } };
  const err = console.error;
  console.error = () => {};
  await handler({ method: 'GET', headers: {} }, res);
  console.error = err;
  assert.equal(res.statusCode, 200);
  for (const loc of ['https://shop.test/shop', 'https://shop.test/fr/shop', 'https://shop.test/ar/shop', 'https://shop.test/fr']) {
    assert.ok(body.includes(`<loc>${loc}</loc>`), loc);
  }
  assert.match(body, /hreflang="fr-MA" href="https:\/\/shop\.test\/fr\/contact"/);
  assert.match(body, /hreflang="x-default"/);
});
