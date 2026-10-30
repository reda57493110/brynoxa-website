const path = require('path');
const jwt = require('jsonwebtoken');
const { connectMongo } = require('../mongo');
const { sendJson } = require('../http');

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
    let ended = false;
    if (header.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
        if (payload.purpose) throw new Error('Not an access token');
        await connectMongo();
        const { logoutUser } = require('../../../backend/dist/services/auth.service');
        await logoutUser(payload.userId);
        ended = true;
      } catch {
        /* token may already be invalid — the session cookie below still names the session */
      }
    }
    if (!ended) {
      // Access token expired: end the session the cookie names, on the server too
      const cookie = String(req.headers.cookie || '')
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith('brynoxa_refresh='));
      const token = cookie ? decodeURIComponent(cookie.slice('brynoxa_refresh='.length)) : '';
      if (token) {
        await connectMongo();
        await require('../../../backend/dist/services/auth.service').logoutByRefreshToken(token);
      }
    }
  } catch (err) {
    console.error('Fast logout failed:', err);
  }

  clearAuthCookies(res);
  sendJson(res, 200, { success: true, message: 'Logged out', data: null });
};
