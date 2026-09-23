const path = require('path');
const { sendJson, readJsonBody } = require('../_lib/http');
const { requireStaff } = require('../_lib/auth');
const { parseImageUpload, assertAllowedImage } = require('../_lib/multipart');

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

async function handleBrandMutation(req, res, route) {
  const user = await requireStaff(req, res, ['products:write']);
  if (!user) return;

  const catalog = require('../../backend/dist/services/catalog.service');

  if (req.method === 'POST' && route === 'brands') {
    const body = await readJsonBody(req);
    const item = await catalog.createBrand(body);
    sendJson(res, 201, { success: true, message: 'Brand created', data: item });
    return;
  }

  const match = route.match(/^brands\/([^/]+)$/);
  if (!match) {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  const id = match[1];
  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const item = await catalog.updateBrand(id, body);
    sendJson(res, 200, { success: true, message: 'Brand updated', data: item });
    return;
  }

  if (req.method === 'DELETE') {
    await catalog.deleteBrand(id);
    sendJson(res, 200, { success: true, message: 'Brand deleted', data: null });
    return;
  }

  sendJson(res, 405, { success: false, message: 'Method not allowed' });
}

async function handleProductRoutes(req, res, route) {
  const catalog = require('../../backend/dist/services/catalog.service');

  if (req.method === 'POST' && route === 'products') {
    const user = await requireStaff(req, res, ['products:write']);
    if (!user) return;
    const body = await readJsonBody(req);
    const item = await catalog.createProduct(body);
    dashboardCache = { at: 0, data: null };
    sendJson(res, 201, { success: true, message: 'Product created', data: item });
    return;
  }

  const inventoryMatch = route.match(/^products\/([^/]+)\/inventory$/);
  if (inventoryMatch && req.method === 'PATCH') {
    const user = await requireStaff(req, res, ['inventory:write']);
    if (!user) return;
    const body = await readJsonBody(req);
    const item = await catalog.updateInventory(
      inventoryMatch[1],
      Number(body.stock),
      body.lowStockThreshold !== undefined ? Number(body.lowStockThreshold) : undefined
    );
    dashboardCache = { at: 0, data: null };
    sendJson(res, 200, { success: true, message: 'Inventory updated', data: item });
    return;
  }

  const match = route.match(/^products\/([^/]+)$/);
  if (!match) {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  const id = match[1];

  if (req.method === 'GET') {
    const user = await requireStaff(req, res, ['products:read']);
    if (!user) return;
    const item = await catalog.getProductById(id);
    sendJson(res, 200, { success: true, message: 'Success', data: item });
    return;
  }

  if (req.method === 'PATCH') {
    const user = await requireStaff(req, res, ['products:write']);
    if (!user) return;
    const body = await readJsonBody(req);
    const item = await catalog.updateProduct(id, body);
    dashboardCache = { at: 0, data: null };
    sendJson(res, 200, { success: true, message: 'Product updated', data: item });
    return;
  }

  if (req.method === 'DELETE') {
    const user = await requireStaff(req, res, ['products:delete']);
    if (!user) return;
    await catalog.deleteProduct(id);
    dashboardCache = { at: 0, data: null };
    sendJson(res, 200, { success: true, message: 'Product deleted', data: null });
    return;
  }

  sendJson(res, 405, { success: false, message: 'Method not allowed' });
}

async function handleUpload(req, res) {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  const user = await requireStaff(req, res, ['products:write', 'inventory:write']);
  if (!user) return;

  const parsed = assertAllowedImage(await parseImageUpload(req));
  const { hasValidImageSignature } = require('../../backend/dist/middleware/upload');
  if (!hasValidImageSignature(parsed)) {
    sendJson(res, 400, {
      success: false,
      message: 'The image file is invalid or corrupted',
    });
    return;
  }

  const { uploadProductImage } = require('../../backend/dist/services/upload.service');
  const result = await uploadProductImage(parsed.buffer, parsed.mimetype);
  sendJson(res, 201, { success: true, message: 'Uploaded', data: result });
}

async function handleCouponRoutes(req, res, route) {
  const user = await requireStaff(req, res, ['coupons']);
  if (!user) return;

  const couponService = require('../../backend/dist/services/coupon.service');

  if (route === 'coupons' && req.method === 'GET') {
    const items = await couponService.listCoupons();
    sendJson(res, 200, { success: true, message: 'Success', data: items });
    return;
  }

  if (route === 'coupons' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const item = await couponService.createCoupon(body);
    sendJson(res, 201, { success: true, message: 'Coupon created', data: item });
    return;
  }

  const match = route.match(/^coupons\/([^/]+)$/);
  if (!match) {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  const id = match[1];
  if (req.method === 'PATCH') {
    const body = await readJsonBody(req);
    const item = await couponService.updateCoupon(id, body);
    sendJson(res, 200, { success: true, message: 'Coupon updated', data: item });
    return;
  }

  if (req.method === 'DELETE') {
    await couponService.deleteCoupon(id);
    sendJson(res, 200, { success: true, message: 'Coupon deleted', data: null });
    return;
  }

  sendJson(res, 405, { success: false, message: 'Method not allowed' });
}

async function handleOrderRoutes(req, res, route, query) {
  const orderService = require('../../backend/dist/services/order.service');

  if (route === 'orders' && req.method === 'GET') {
    const user = await requireStaff(req, res, ['orders:read']);
    if (!user) return;
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const result = await orderService.listAllOrders(page, limit, query.status, query.q);
    sendJson(res, 200, paginated(result.items, result.page, result.limit, result.total));
    return;
  }

  const statusMatch = route.match(/^orders\/([^/]+)\/status$/);
  if (statusMatch && req.method === 'PATCH') {
    const user = await requireStaff(req, res, ['orders:write']);
    if (!user) return;
    const body = await readJsonBody(req);
    const order = await orderService.updateOrderStatus(
      statusMatch[1],
      body.orderStatus,
      body.note,
      body.adminNote
    );
    dashboardCache = { at: 0, data: null };
    sendJson(res, 200, { success: true, message: 'Order updated', data: order });
    return;
  }

  const match = route.match(/^orders\/([^/]+)$/);
  if (match && req.method === 'GET') {
    const user = await requireStaff(req, res, ['orders:read']);
    if (!user) return;
    const item = await orderService.getOrderById(match[1]);
    sendJson(res, 200, { success: true, message: 'Success', data: item });
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

    // Product form brand create/update — keep off the slow Express lambda.
    if (route === 'brands' || route.startsWith('brands/')) {
      if (req.method === 'GET') {
        sendJson(res, 405, { success: false, message: 'Use GET /brands' });
        return;
      }
      await handleBrandMutation(req, res, route);
      return;
    }

    // Admin product CRUD + inventory — keep off the slow Express lambda.
    if (route === 'products' || route.startsWith('products/')) {
      await handleProductRoutes(req, res, route);
      return;
    }

    // Product image upload (multipart) — keep off the slow Express lambda.
    if (route === 'upload') {
      await handleUpload(req, res);
      return;
    }

    // Coupons list + CRUD
    if (route === 'coupons' || route.startsWith('coupons/')) {
      await handleCouponRoutes(req, res, route);
      return;
    }

    // Orders list/detail + status updates
    if (route === 'orders' || route.startsWith('orders/')) {
      await handleOrderRoutes(req, res, route, query);
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
