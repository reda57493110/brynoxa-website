const path = require('path');
const jwt = require('jsonwebtoken');
const { connectMongo } = require('../../_lib/mongo');
const { sendJson } = require('../../_lib/http');

const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

function clearAuthCookies(res) {
  const secure = process.env.NODE_ENV === 'production';
  const base = `Path=/api/v1/auth; ${secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=0`;
  res.setHeader('Set-Cookie', [
    `brynoxa_refresh=; HttpOnly; ${base}`,
    `brynoxa_csrf=; ${base}`,
  ]);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const header = req.headers.authorization || '';
    if (header.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET);
        await connectMongo();
        const { logoutUser } = require('../../../backend/dist/services/auth.service');
        await logoutUser(payload.userId);
      } catch {
        /* token may already be invalid — still clear cookies */
      }
    }
  } catch (err) {
    console.error('Fast logout failed:', err);
  }

  clearAuthCookies(res);
  sendJson(res, 200, { success: true, message: 'Logged out', data: null });
};
