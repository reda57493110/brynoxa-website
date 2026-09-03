const path = require('path');
const Module = require('module');
const { connectMongo } = require('../_lib/mongo');
const { sendJson } = require('../_lib/http');
const { requireStaff } = require('../_lib/auth');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

function parseQuery(url) {
  const queryString = url.includes('?') ? url.split('?')[1] : '';
  return Object.fromEntries(new URLSearchParams(queryString));
}

function toBool(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    await connectMongo();
    try {
      const { syncCatalogIfNeeded } = require('../../backend/dist/seed/seed');
      await syncCatalogIfNeeded();
    } catch (err) {
      console.error('Catalog sync skipped:', err);
    }
    const { listProducts } = require('../../backend/dist/services/catalog.service');
    const raw = parseQuery(req.url || '');
    const page = Number(raw.page || 1);
    const limit = Number(raw.limit || 12);
    const isAdmin = raw.admin === 'true';
    if (isAdmin) {
      const user = await requireStaff(req, res, ['products:read']);
      if (!user) return;
    }

    const result = await listProducts({
      page,
      limit,
      sort: raw.sort,
      q: raw.q,
      category: raw.category,
      brand: raw.brand,
      minPrice: raw.minPrice !== undefined ? Number(raw.minPrice) : undefined,
      maxPrice: raw.maxPrice !== undefined ? Number(raw.maxPrice) : undefined,
      featured: raw.featured === 'true',
      carousel: raw.carousel === 'true',
      inStock: raw.inStock === 'true',
      admin: isAdmin,
      isActive: toBool(raw.isActive),
    });

    sendJson(res, 200, {
      success: true,
      message: 'Success',
      data: result.items,
      meta: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        pages: Math.ceil(result.total / result.limit) || 1,
      },
    });
  } catch (err) {
    console.error('Fast products failed:', err);
    sendJson(res, 500, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
