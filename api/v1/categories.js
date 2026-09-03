const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson } = require('../_lib/http');

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

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    await connectMongo();
    await ensureCatalog();

    const { pathname, query } = parseUrl(req.url || '');
    const route = resolveRoute(pathname, query);
    const catalog = require('../../backend/dist/services/catalog.service');

    // GET /categories/:slug
    if (route) {
      const category = await catalog.getCategoryBySlug(route);
      sendJson(res, 200, { success: true, message: 'Success', data: category });
      return;
    }

    // GET /categories
    const items = await catalog.listCategories(query.all === 'true');
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
