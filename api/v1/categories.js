const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson } = require('../_lib/http');
const { optionalUser } = require('../_lib/auth');

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
  return pathname.replace(/^\/api\/v1\/categories\/?/, '').replace(/\/$/, '');
}

async function ensureCatalog() {
  try {
    const { syncCatalogIfNeeded } = require('../../backend/dist/seed/seed');
    await syncCatalogIfNeeded();
  } catch (err) {
    console.error('Catalog sync skipped:', err);
  }
}

async function handleBrands(req, res, query) {
  if (req.method !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  let activeOnly = true;
  if (query.all === 'true') {
    const user = await optionalUser(req);
    if (user) {
      const { isStaffRole } = require('../../backend/dist/permissions');
      if (isStaffRole(user.role)) activeOnly = false;
    }
  }

  const catalog = require('../../backend/dist/services/catalog.service');
  const items = await catalog.listBrands(activeOnly);
  sendJson(res, 200, { success: true, message: 'Success', data: items });
}

module.exports = async (req, res) => {
  try {
    await connectMongo();
    await ensureCatalog();

    const { pathname, query } = parseUrl(req.url || '');

    // Brands are rewritten here to stay under the Hobby 12-function limit.
    if (query.__resource === 'brands') {
      await handleBrands(req, res, query);
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { success: false, message: 'Method not allowed' });
      return;
    }

    const route = resolveRoute(pathname, query);
    const catalog = require('../../backend/dist/services/catalog.service');

    // GET /categories/:slug
    if (route) {
      const category = await catalog.getCategoryBySlug(route);
      sendJson(res, 200, { success: true, message: 'Success', data: category });
      return;
    }

    // GET /categories — `?all=true` returns inactive too (admin); storefront omits them.
    const activeOnly = query.all !== 'true';
    const items = await catalog.listCategories(activeOnly);
    sendJson(res, 200, {
      success: true,
      message: 'Success',
      data: items,
    });
  } catch (err) {
    console.error('Fast categories failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
