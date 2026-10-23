const path = require('path');
const jwt = require('jsonwebtoken');
const { connectMongo } = require('./mongo');
const { sendJson } = require('./http');
const { issuedBeforePasswordChange } = require('../../backend/dist/utils/tokenFreshness');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

/** Verifies an access token; step tokens (MFA challenge) are refused. */
function verifyAccessJwt(token) {
  const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
  if (!payload || typeof payload !== 'object' || payload.purpose || !payload.userId) {
    throw new Error('Not an access token');
  }
  return payload;
}

async function loadUserFromAuthHeader(req) {
  await connectMongo();

  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;

  let payload;
  try {
    payload = verifyAccessJwt(header.slice(7));
  } catch {
    return null;
  }

  const { User } = require('../../backend/dist/models/User');
  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) return null;
  if (issuedBeforePasswordChange(payload, user)) return null;
  return user;
}

/** Optional auth — returns null when missing/invalid (no 401). */
async function optionalUser(req) {
  return loadUserFromAuthHeader(req);
}

async function requireUser(req, res) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    sendJson(res, 401, { success: false, message: 'Authentication required' });
    return null;
  }

  let payload;
  try {
    payload = verifyAccessJwt(header.slice(7));
  } catch {
    sendJson(res, 401, { success: false, message: 'Invalid or expired token' });
    return null;
  }

  await connectMongo();
  const { User } = require('../../backend/dist/models/User');
  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    sendJson(res, 401, { success: false, message: 'User not found or inactive' });
    return null;
  }
  if (issuedBeforePasswordChange(payload, user)) {
    sendJson(res, 401, { success: false, message: 'Session ended after a password change — please sign in again' });
    return null;
  }

  return user;
}

/**
 * Staff with the given permission. After the grace period staff need 2-step sign-in
 * (utils/mfaPolicy); `allowWithoutMfa` is only for the pages that set it up.
 */
async function requireStaff(req, res, permissions = [], { allowWithoutMfa = false } = {}) {
  const user = await requireUser(req, res);
  if (!user) return null;

  const { hasPermission, isStaffRole } = require('../../backend/dist/permissions');
  if (!isStaffRole(user.role)) {
    sendJson(res, 403, { success: false, message: 'Staff access required' });
    return null;
  }
  const policy = require('../../backend/dist/utils/mfaPolicy');
  if (!allowWithoutMfa && policy.mfaSetupOverdue(user)) {
    sendJson(res, 403, { success: false, message: policy.MFA_REQUIRED_MESSAGE, code: policy.MFA_REQUIRED_CODE });
    return null;
  }
  if (permissions.length && !permissions.some((permission) => hasPermission(user.role, permission))) {
    sendJson(res, 403, { success: false, message: 'You do not have permission for this action' });
    return null;
  }

  return user;
}

module.exports = { optionalUser, requireUser, requireStaff };
