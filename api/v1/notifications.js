const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson } = require('../_lib/http');
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
  return pathname.replace(/^\/api\/v1\/notifications\/?/, '').replace(/\/$/, '');
}

module.exports = async (req, res) => {
  try {
    await connectMongo();

    const user = await requireUser(req, res);
    if (!user) return;

    const userId = user._id.toString();
    const { pathname, query } = parseUrl(req.url || '');
    const route = resolveRoute(pathname, query);
    const notificationService = require('../../backend/dist/services/notification.service');

    // GET /notifications
    if (!route && req.method === 'GET') {
      const [items, unread] = await Promise.all([
        notificationService.listNotifications(userId),
        notificationService.unreadCount(userId),
      ]);
      sendJson(res, 200, {
        success: true,
        message: 'Success',
        data: { items, unread },
      });
      return;
    }

    // POST /notifications/read-all
    if (route === 'read-all' && req.method === 'POST') {
      const items = await notificationService.markAllRead(userId);
      sendJson(res, 200, { success: true, message: 'Success', data: items });
      return;
    }

    // PATCH /notifications/:id/read
    const readMatch = route.match(/^([^/]+)\/read$/);
    if (readMatch && req.method === 'PATCH') {
      const item = await notificationService.markRead(userId, readMatch[1]);
      sendJson(res, 200, { success: true, message: 'Success', data: item });
      return;
    }

    sendJson(res, 405, { success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Fast notifications failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
