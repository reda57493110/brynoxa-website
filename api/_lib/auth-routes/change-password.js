const path = require('path');
const { sendJson, readJsonBody } = require('../http');
const { requireUser } = require('../auth');

const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const body = await readJsonBody(req);
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      sendJson(res, 400, { success: false, message: 'Invalid password payload' });
      return;
    }

    const { changePassword } = require('../../../backend/dist/services/auth.service');
    await changePassword(user._id.toString(), currentPassword, newPassword);
    sendJson(res, 200, { success: true, message: 'Password changed', data: null });
  } catch (err) {
    console.error('Fast change-password failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
