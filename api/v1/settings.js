const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson, readJsonBody } = require('../_lib/http');
const { requireStaff } = require('../_lib/auth');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const ALLOWED_FIELDS = [
  'storeName',
  'currency',
  'shippingFlatRate',
  'freeShippingMin',
  'taxRate',
  'supportEmail',
  'codEnabled',
];

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      await connectMongo();
      const { getSettings } = require('../../backend/dist/models/Settings');
      const settings = await getSettings();
      sendJson(res, 200, { success: true, message: 'Success', data: settings });
      return;
    }

    if (req.method === 'PATCH') {
      const user = await requireStaff(req, res, ['settings']);
      if (!user) return;

      const body = await readJsonBody(req);
      const { getSettings } = require('../../backend/dist/models/Settings');
      const settings = await getSettings();

      for (const key of ALLOWED_FIELDS) {
        if (body[key] !== undefined) {
          settings[key] = body[key];
        }
      }
      await settings.save();

      sendJson(res, 200, {
        success: true,
        message: 'Settings updated',
        data: settings,
      });
      return;
    }

    sendJson(res, 405, { success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Fast settings failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
