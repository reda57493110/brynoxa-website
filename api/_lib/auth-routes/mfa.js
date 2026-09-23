const path = require('path');
const { sendJson, readJsonBody } = require('../http');
const { requireStaff } = require('../auth');
const { parseBody } = require('./cookies');

const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

/**
 * Staff MFA management: setup / verify / disable.
 * Action comes from auth.js as req.__authAction (e.g. "mfa/setup").
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const user = await requireStaff(req, res);
    if (!user) return;

    const action = req.__authAction || '';
    const authService = require('../../../backend/dist/services/auth.service');
    const schemas = require('../../../backend/dist/validators/schemas');
    const userId = user._id.toString();

    if (action === 'mfa/setup') {
      const data = await authService.setupMfa(userId);
      sendJson(res, 200, {
        success: true,
        message: 'MFA setup created',
        data,
      });
      return;
    }

    if (action === 'mfa/verify') {
      const body = await readJsonBody(req);
      const data = parseBody(schemas.mfaCodeSchema, body);
      const result = await authService.verifyMfaSetup(userId, data.code);
      sendJson(res, 200, {
        success: true,
        message: 'MFA enabled',
        data: result,
      });
      return;
    }

    if (action === 'mfa/disable') {
      const body = await readJsonBody(req);
      const data = parseBody(schemas.mfaCodeSchema, body);
      await authService.disableMfa(userId, data.code);
      sendJson(res, 200, {
        success: true,
        message: 'MFA disabled',
        data: null,
      });
      return;
    }

    sendJson(res, 404, { success: false, message: 'Not found' });
  } catch (err) {
    console.error('Fast MFA management failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
