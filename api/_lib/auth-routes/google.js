const path = require('path');
const { connectMongo } = require('../mongo');
const { sendJson, readJsonBody, sendError } = require('../http');
const { setAuthCookies, parseBody } = require('./cookies');
const { rateLimit } = require('../rateLimit');

const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

/**
 * POST /api/v1/auth/google — "Continue with Google" (same rules as the Express route:
 * backend services/auth.service.ts signInWithGoogle; Google's token checked in googleAuth.service).
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }
  try {
    // Same limit as signing in with a password (per connection)
    if (!(await rateLimit(req, res, 'login'))) return;
    const body = await readJsonBody(req);
    const schemas = require('../../../backend/dist/validators/schemas');
    const data = parseBody(schemas.googleSignInSchema, body);
    await connectMongo();
    const authService = require('../../../backend/dist/services/auth.service');
    const result = await authService.signInWithGoogle(data.credential);
    setAuthCookies(res, result.refreshToken);
    sendJson(res, 200, {
      success: true,
      message: 'Logged in',
      data: { user: { ...result.user, addresses: result.user.addresses || [] }, accessToken: result.accessToken },
    });
  } catch (err) {
    console.error('Google sign-in failed:', err && err.message);
    sendError(res, err);
  }
};
