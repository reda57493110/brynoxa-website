const path = require('path');
const { sendJson, readJsonBody } = require('../../_lib/http');
const { requireUser } = require('../../_lib/auth');

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
      const body = await readJsonBody(req);
      if (body.name !== undefined) user.name = String(body.name).trim();
      if (body.phone !== undefined) user.phone = String(body.phone).trim();
      await user.save();
      sendJson(res, 200, {
        success: true,
        message: 'Profile updated',
        data: authService.sanitizeUser(user),
      });
      return;
    }

    if (route === 'addresses' && req.method === 'POST') {
      const body = await readJsonBody(req);
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
        const body = await readJsonBody(req);
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
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
