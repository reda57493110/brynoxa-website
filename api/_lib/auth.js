const path = require('path');
const jwt = require('jsonwebtoken');
const { connectMongo } = require('./mongo');
const { sendJson } = require('./http');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

async function requireUser(req, res) {
  await connectMongo();

  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    sendJson(res, 401, { success: false, message: 'Authentication required' });
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), process.env.JWT_ACCESS_SECRET);
  } catch {
    sendJson(res, 401, { success: false, message: 'Invalid or expired token' });
    return null;
  }

  const { User } = require('../../backend/dist/models/User');
  const user = await User.findById(payload.userId);
  if (!user || !user.isActive) {
    sendJson(res, 401, { success: false, message: 'User not found or inactive' });
    return null;
  }

  return user;
}

async function requireStaff(req, res, permissions = []) {
  const user = await requireUser(req, res);
  if (!user) return null;

  const { hasPermission, isStaffRole } = require('../../backend/dist/permissions');
  if (!isStaffRole(user.role)) {
    sendJson(res, 403, { success: false, message: 'Staff access required' });
    return null;
  }
  if (permissions.length && !permissions.some((permission) => hasPermission(user.role, permission))) {
    sendJson(res, 403, { success: false, message: 'You do not have permission for this action' });
    return null;
  }

  return user;
}

module.exports = { requireUser, requireStaff };
