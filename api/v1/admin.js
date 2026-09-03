const path = require('path');
const { sendJson } = require('../_lib/http');
const { requireStaff } = require('../_lib/auth');

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

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const { pathname, query } = parseUrl(req.url || '');
    const route = (
      query.__route
        ? String(query.__route)
        : pathname.replace(/^\/api\/v1\/admin\/?/, '')
    )
      .replace(/^\/+|\/+$/g, '');
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
      const { getDashboardStats } = require('../../backend/dist/services/admin.service');
      const stats = await getDashboardStats();
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
    sendJson(res, 500, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
