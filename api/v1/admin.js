const path = require('path');
const { sendJson, readJsonBody } = require('../_lib/http');
const { requireStaff } = require('../_lib/auth');

const backendNodeModules = path.join(__dirname, '../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const DASHBOARD_CACHE_MS = 45_000;
let dashboardCache = { at: 0, data: null };

function parseUrl(url = '') {
  const [pathname, queryString = ''] = url.split('?');
  return {
    pathname,
    query: Object.fromEntries(new URLSearchParams(queryString)),
  };
}

function paginated(items, page, limit, total) {
  return {
    success: true,
    message: 'Success',
    data: items,
    meta: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit) || 1,
    },
  };
}

async function handleCategoryMutation(req, res, route) {
  const user = await requireStaff(req, res, ['products:write']);
  if (!user) return;

  const catalog = require('../../backend/dist/services/catalog.service');

  if (req.method === 'POST' && route === 'categories') {
    const body = await readJsonBody(req);
    const item = await catalog.createCategory(body);
    sendJson(res, 201, { success: true, message: 'Category created', data: item });
    return;
  }

  const match = route.match(/^categories\/([^/]+)$/);
  if (!match) {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  const id = match[1];
  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const item = await catalog.updateCategory(id, body);
    sendJson(res, 200, { success: true, message: 'Category updated', data: item });
    return;
  }

  if (req.method === 'DELETE') {
    await catalog.deleteCategory(id);
    sendJson(res, 200, { success: true, message: 'Category deleted', data: null });
    return;
  }

  sendJson(res, 405, { success: false, message: 'Method not allowed' });
}

module.exports = async (req, res) => {
  try {
    const { pathname, query } = parseUrl(req.url || '');
    const route = (
      query.__route
        ? String(query.__route)
        : pathname.replace(/^\/api\/v1\/admin\/?/, '')
    )
      .replace(/^\/+|\/+$/g, '');

    // Settings page category CRUD — keep off the slow Express lambda.
    if (
      route === 'categories' ||
      route.startsWith('categories/')
    ) {
      if (req.method === 'GET') {
        sendJson(res, 405, { success: false, message: 'Use GET /categories' });
        return;
      }
      await handleCategoryMutation(req, res, route);
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { success: false, message: 'Method not allowed' });
      return;
    }

    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);

    if (!route || route === 'dashboard') {
      const user = await requireStaff(req, res, [
        'dashboard',
        'orders:read',
        'inventory:write',
        'messages',
        'coupons',
        'reviews',
      ]);
      if (!user) return;
      const now = Date.now();
      if (dashboardCache.data && now - dashboardCache.at < DASHBOARD_CACHE_MS) {
        sendJson(res, 200, { success: true, message: 'Success', data: dashboardCache.data });
        return;
      }
      const { getDashboardStats } = require('../../backend/dist/services/admin.service');
      const stats = await getDashboardStats();
      dashboardCache = { at: now, data: stats };
      sendJson(res, 200, { success: true, message: 'Success', data: stats });
      return;
    }

    if (route === 'orders') {
      const user = await requireStaff(req, res, ['orders:read']);
      if (!user) return;
      const { listAllOrders } = require('../../backend/dist/services/order.service');
      const result = await listAllOrders(page, limit, query.status, query.q);
      sendJson(res, 200, paginated(result.items, result.page, result.limit, result.total));
      return;
    }

    if (route.startsWith('orders/')) {
      const user = await requireStaff(req, res, ['orders:read']);
      if (!user) return;
      const { getOrderById } = require('../../backend/dist/services/order.service');
      const item = await getOrderById(route.slice('orders/'.length));
      sendJson(res, 200, { success: true, message: 'Success', data: item });
      return;
    }

    if (route === 'customers') {
      const user = await requireStaff(req, res, ['customers:read']);
      if (!user) return;
      const { listCustomers } = require('../../backend/dist/services/admin.service');
      const result = await listCustomers(page, limit, query.q);
      sendJson(res, 200, paginated(result.items, result.page, result.limit, result.total));
      return;
    }

    if (route === 'users') {
      const user = await requireStaff(req, res, ['users:manage']);
      if (!user) return;
      const { listUsers } = require('../../backend/dist/services/admin.service');
      const result = await listUsers(page, limit, query.q, query.role);
      sendJson(res, 200, paginated(result.items, result.page, result.limit, result.total));
      return;
    }

    if (route === 'reviews') {
      const user = await requireStaff(req, res, ['reviews']);
      if (!user) return;
      const { listAllReviews } = require('../../backend/dist/services/review.service');
      const result = await listAllReviews(page, limit);
      sendJson(res, 200, paginated(result.items, result.page, result.limit, result.total));
      return;
    }

    if (route === 'coupons') {
      const user = await requireStaff(req, res, ['coupons']);
      if (!user) return;
      const { listCoupons } = require('../../backend/dist/services/coupon.service');
      const items = await listCoupons();
      sendJson(res, 200, { success: true, message: 'Success', data: items });
      return;
    }

    if (route === 'messages') {
      const user = await requireStaff(req, res, ['messages']);
      if (!user) return;
      const { listMessages } = require('../../backend/dist/services/admin.service');
      const result = await listMessages(page, limit, query.status);
      sendJson(res, 200, paginated(result.items, result.page, result.limit, result.total));
      return;
    }

    if (route === 'subscribers') {
      const user = await requireStaff(req, res, ['messages']);
      if (!user) return;
      const { listSubscribers } = require('../../backend/dist/services/admin.service');
      const items = await listSubscribers();
      sendJson(res, 200, { success: true, message: 'Success', data: items });
      return;
    }

    sendJson(res, 404, { success: false, message: 'Not found' });
  } catch (err) {
    console.error('Fast admin failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
