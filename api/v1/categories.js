const path = require('path');
const Module = require('module');
const { connectMongo } = require('../_lib/mongo');
const { sendJson } = require('../_lib/http');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
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
    const { listCategories } = require('../../backend/dist/services/catalog.service');
    const items = await listCategories(true);
    sendJson(res, 200, {
      success: true,
      message: 'Success',
      data: items,
    });
  } catch (err) {
    console.error('Fast categories failed:', err);
    sendJson(res, 500, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
