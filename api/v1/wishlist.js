const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson, readJsonBody } = require('../_lib/http');
const { requireUser } = require('../_lib/auth');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
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
  return pathname.replace(/^\/api\/v1\/wishlist\/?/, '').replace(/\/$/, '');
}

module.exports = async (req, res) => {
  try {
    await connectMongo();

    const user = await requireUser(req, res);
    if (!user) return;

    const userId = user._id.toString();
    const { pathname, query } = parseUrl(req.url || '');
    const route = resolveRoute(pathname, query);
    const wishlistService = require('../../backend/dist/services/wishlist.service');

    // GET /wishlist
    if (!route && req.method === 'GET') {
      const wishlist = await wishlistService.getWishlist(userId);
      sendJson(res, 200, { success: true, message: 'Success', data: wishlist });
      return;
    }

    // POST /wishlist — { productId }
    if (!route && req.method === 'POST') {
      const body = await readJsonBody(req);
      const productId = String(body.productId || '');
      if (!productId) {
        sendJson(res, 400, { success: false, message: 'productId is required' });
        return;
      }
      const wishlist = await wishlistService.addToWishlist(userId, productId);
      sendJson(res, 200, { success: true, message: 'Added to wishlist', data: wishlist });
      return;
    }

    // POST /wishlist/sync — { productIds: string[] }
    if (route === 'sync' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const productIds = Array.isArray(body.productIds) ? body.productIds.map(String) : [];
      const wishlist = await wishlistService.syncWishlist(userId, productIds);
      sendJson(res, 200, { success: true, message: 'Wishlist synced', data: wishlist });
      return;
    }

    // DELETE /wishlist/:productId
    if (route && !route.includes('/') && req.method === 'DELETE') {
      const wishlist = await wishlistService.removeFromWishlist(userId, route);
      sendJson(res, 200, { success: true, message: 'Removed from wishlist', data: wishlist });
      return;
    }

    sendJson(res, 405, { success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Fast wishlist failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
