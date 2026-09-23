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

    const { query } = parseUrl(req.url || '');
    // Match Express: inactive brands only when staff + `?all=true` (admin product form).
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
    sendJson(res, 200, {
      success: true,
      message: 'Success',
      data: items,
    });
  } catch (err) {
    console.error('Fast brands failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
