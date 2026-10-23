// Shop brand filter: only brands that a visible product uses; staff still see every brand.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dist, setTestEnv } = require('./_helpers.cjs');
setTestEnv();

const { Brand } = require(dist('models/Brand'));
const { Product } = require(dist('models/Product'));
const catalog = require(dist('services/catalog.service'));

test('public brand list only has brands used by visible products', async () => {
  let productFilter;
  let brandFilter;
  Product.distinct = async (field, filter) => {
    assert.equal(field, 'brand');
    productFilter = filter;
    return ['b-hp', 'b-dell'];
  };
  Brand.find = (filter) => {
    brandFilter = filter;
    return { sort: async () => [] };
  };
  await catalog.listBrands(true);
  assert.equal(productFilter.isActive, true, 'hidden products do not count');
  assert.deepEqual(brandFilter, { isActive: true, _id: { $in: ['b-hp', 'b-dell'] } });
});

test('staff list has every brand (to pick one for a new product)', async () => {
  let brandFilter;
  Product.distinct = async () => {
    throw new Error('not needed for staff');
  };
  Brand.find = (filter) => {
    brandFilter = filter;
    return { sort: async () => [] };
  };
  await catalog.listBrands(false);
  assert.deepEqual(brandFilter, {});
});
