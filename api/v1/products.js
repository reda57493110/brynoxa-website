const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson } = require('../_lib/http');
const { requireStaff } = require('../_lib/auth');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

function parseUrl(url = '') {
  const [pathname, queryString = ''] = url.split('?');
  return {
    pathname,
    query: Object.fromEntries(new URLSearchParams(queryString)),
  };
}

function resolveRoute(pathname, query) {
  if (query.__route) {
    return String(query.__route).replace(/^\/+|\/+$/g, '');
  }
  return pathname.replace(/^\/api\/v1\/products\/?/, '').replace(/\/$/, '');
}

async function ensureCatalog() {
  try {
    const { syncCatalogIfNeeded } = require('../../backend/dist/seed/seed');
    await syncCatalogIfNeeded();
  } catch (err) {
    console.error('Catalog sync skipped:', err);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    await connectMongo();
    await ensureCatalog();

    const { pathname, query: raw } = parseUrl(req.url || '');
    const route = resolveRoute(pathname, raw);
    const catalog = require('../../backend/dist/services/catalog.service');

    // GET /products/:id/reviews
    if (route.includes('/reviews')) {
      const productId = route.split('/')[0];
      const page = Number(raw.page || 1);
      const limit = Number(raw.limit || 20);
      const { listProductReviews } = require('../../backend/dist/services/review.service');
      const result = await listProductReviews(productId, page, limit);
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
      return;
    }

    // GET /products/compare?ids=
    if (route === 'compare') {
      const ids = String(raw.ids || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
        .slice(0, 4);
      const items = await catalog.getProductsByIds(ids);
      sendJson(res, 200, { success: true, message: 'Success', data: items });
      return;
    }

    // GET /products/:slug
    if (route) {
      const product = await catalog.getProductBySlug(route);
      sendJson(res, 200, { success: true, message: 'Success', data: product });
      return;
    }

    // GET /products
    const page = Number(raw.page || 1);
    const limit = Number(raw.limit || 12);
    const isAdmin = raw.admin === 'true';
    if (isAdmin) {
      const user = await requireStaff(req, res, ['products:read']);
      if (!user) return;
    }

    const result = await catalog.listProducts({
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
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};

function toBool(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}
