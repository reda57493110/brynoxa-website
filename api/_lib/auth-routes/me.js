const path = require('path');
const { sendJson, readJsonBody, sendError } = require('../http');
const { requireUser } = require('../auth');

/** Same checks as the Express routes (unknown fields dropped, sizes limited). */
function validated(schemaName, body, partial = false) {
  const schemas = require('../../../backend/dist/validators/schemas');
  const schema = partial ? schemas[schemaName].partial() : schemas[schemaName];
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0];
    const where = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
    const err = new Error(`${where}${issue?.message || 'Invalid data'}`);
    err.statusCode = 400;
    throw err;
  }
  return parsed.data;
}

const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
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

function resolveRoute(pathname, query) {
  if (query.__route) {
    return String(query.__route).replace(/^\/+|\/+$/g, '');
  }
  return pathname.replace(/^\/api\/v1\/auth\/me\/?/, '').replace(/\/$/, '');
}

module.exports = async (req, res) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;

    const { pathname, query } = parseUrl(req.url || '');
    const route = resolveRoute(pathname, query);
    const authService = require('../../../backend/dist/services/auth.service');

    if (!route && req.method === 'GET') {
      sendJson(res, 200, {
        success: true,
        message: 'Success',
        data: authService.sanitizeUser(user),
      });
      return;
    }

    if (!route && req.method === 'PATCH') {
      const body = validated('updateProfileSchema', await readJsonBody(req));
      if (body.name !== undefined) user.name = body.name;
      if (body.phone !== undefined) user.phone = body.phone;
      await user.save();
      sendJson(res, 200, {
        success: true,
        message: 'Profile updated',
        data: authService.sanitizeUser(user),
      });
      return;
    }

    if (route === 'addresses' && req.method === 'POST') {
      const body = validated('addressSchema', await readJsonBody(req));
      if (body.isDefault || user.addresses.length === 0) {
        user.addresses.forEach((a) => {
          a.isDefault = false;
        });
        body.isDefault = true;
      }
      user.addresses.push(body);
      await user.save();
      sendJson(res, 201, {
        success: true,
        message: 'Address added',
        data: authService.sanitizeUser(user),
      });
      return;
    }

    const addressMatch = route.match(/^addresses\/([^/]+)$/);
    if (addressMatch) {
      const addressId = addressMatch[1];
      const address = user.addresses.id(addressId);
      if (!address) {
        sendJson(res, 404, { success: false, message: 'Address not found' });
        return;
      }

      if (req.method === 'PATCH') {
        const body = validated('addressSchema', await readJsonBody(req), true);
        Object.assign(address, body);
        if (body.isDefault) {
          user.addresses.forEach((a) => {
            a.isDefault = a._id?.toString() === addressId;
          });
        }
        await user.save();
        sendJson(res, 200, {
          success: true,
          message: 'Address updated',
          data: authService.sanitizeUser(user),
        });
        return;
      }

      if (req.method === 'DELETE') {
        user.addresses = user.addresses.filter((a) => a._id?.toString() !== addressId);
        await user.save();
        sendJson(res, 200, {
          success: true,
          message: 'Address removed',
          data: authService.sanitizeUser(user),
        });
        return;
      }
    }

    sendJson(res, 405, { success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Fast auth/me failed:', err);
    sendError(res, err);
  }
};
