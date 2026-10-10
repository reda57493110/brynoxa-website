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

/**
 * Hands a request to the full Express app (same code as local dev). Used for admin routes this
 * fast handler does not implement, so they work on Vercel instead of failing with 405/404.
 * Must run before anything reads the request body.
 */
function delegateToExpress(req, res, route, query) {
  const { getApp } = require('../../backend/dist/app');
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (!key.startsWith('__')) params.set(key, value);
  }
  const qs = params.toString();
  req.url = `/api/v1/admin/${route}${qs ? `?${qs}` : ''}`;
  return new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    getApp()(req, res);
  });
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

  const depositMatch = route.match(/^orders\/([^/]+)\/deposit$/);
  if (depositMatch && req.method === 'PATCH') {
    const user = await requireStaff(req, res, ['orders:write']);
    if (!user) return;
    const { orderDepositSchema } = require('../../backend/dist/validators/schemas');
    const parsed = orderDepositSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      sendJson(res, 400, { success: false, message: 'Invalid deposit details' });
      return;
    }
    const order = await orderService.setOrderDeposit(depositMatch[1], parsed.data);
    dashboardCache = { at: 0, data: null };
    sendJson(res, 200, { success: true, message: 'Deposit updated', data: order });
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

  if (match && req.method === 'DELETE') {
    const user = await requireStaff(req, res, ['orders:write']);
    if (!user) return;
    await orderService.deleteOrder(match[1]);
    dashboardCache = { at: 0, data: null };
    sendJson(res, 200, { success: true, message: 'Order deleted', data: null });
    return;
  }

  sendJson(res, 405, { success: false, message: 'Method not allowed' });
}

async function handlePushRoutes(req, res, route) {
  const user = await requireStaff(req, res, ['push']);
  if (!user) return;

  const pushService = require('../../backend/dist/services/push.service');

  if (route === 'push' && req.method === 'GET') {
    const data = await pushService.getPushOverview(String(user._id));
    sendJson(res, 200, { success: true, message: 'Success', data });
    return;
  }

  if ((route === 'push/send' || route === 'push/test') && req.method === 'POST') {
    const { pushSendSchema } = require('../../backend/dist/validators/schemas');
    const parsed = pushSendSchema.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      sendJson(res, 400, {
        success: false,
        message: parsed.error.issues?.[0]?.message || 'Validation failed',
      });
      return;
    }

    if (route === 'push/test') {
      const result = await pushService.sendTestPush(parsed.data, String(user._id));
      sendJson(res, 200, { success: true, message: 'Test sent', data: result });
      return;
    }

    const campaign = await pushService.sendPushCampaign(parsed.data, {
      id: String(user._id),
      name: user.name,
    });
    sendJson(res, 201, { success: true, message: 'Notification sent', data: campaign });
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

    // POST /admin/email-test — send a sample email to the signed-in staff member
    if (route === 'email-test' && req.method === 'POST') {
      const user = await requireStaff(req, res, ['settings']);
      if (!user) return;
      const { emailTestSchema } = require('../../backend/dist/validators/schemas');
      const parsed = emailTestSchema.safeParse(await readJsonBody(req));
      if (!parsed.success) {
        sendJson(res, 400, { success: false, message: 'Unknown email type' });
        return;
      }
      const { sendTestEmail } = require('../../backend/dist/services/emailTest.service');
      const result = await sendTestEmail(String(user._id), parsed.data.type);
      sendJson(res, 200, { success: true, message: `Test email sent to ${result.sentTo}`, data: result });
      return;
    }

    // GET/POST /admin/emails — staff emails to customers, with a sent log
    if (route === 'emails') {
      const user = await requireStaff(req, res, ['messages']);
      if (!user) return;
      const manual = require('../../backend/dist/services/manualEmail.service');
      if (req.method === 'GET') {
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
        const result = await manual.listSentEmails(page, limit, query.to ? String(query.to) : undefined);
        sendJson(res, 200, paginated(result.items, result.page, result.limit, result.total));
        return;
      }
      if (req.method === 'POST') {
        const { manualEmailSchema } = require('../../backend/dist/validators/schemas');
        const parsed = manualEmailSchema.safeParse(await readJsonBody(req));
        if (!parsed.success) {
          sendJson(res, 400, { success: false, message: 'Check the email address, subject and message' });
          return;
        }
        const result = await manual.sendManualEmail({ ...parsed.data, sentBy: String(user._id) });
        sendJson(res, 200, { success: true, message: `Email sent to ${result.sentTo}`, data: result });
        return;
      }
      sendJson(res, 405, { success: false, message: 'Method not allowed' });
      return;
    }

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

    // Stock edits go through the inventory ledger in Express (reason + approval + audit log)
    if (/^products\/[^/]+\/inventory$/.test(route)) {
      await delegateToExpress(req, res, route, query);
      return;
    }

    // Variant groups are handled by Express
    if (/^products\/[^/]+\/variants$/.test(route)) {
      await delegateToExpress(req, res, route, query);
      return;
    }

    // Admin product CRUD — keep off the slow Express lambda.
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

    // Refunds are recorded by the Express app
    if (/^orders\/[^/]+\/(refunds|returns)$/.test(route)) {
      await delegateToExpress(req, res, route, query);
      return;
    }

    // Orders list/detail + status updates
    if (route === 'orders' || route.startsWith('orders/')) {
      await handleOrderRoutes(req, res, route, query);
      return;
    }

    // Customer management (list, profile, edits, wholesale, export) lives in Express
    if (route === 'customers' || route.startsWith('customers/')) {
      await delegateToExpress(req, res, route, query);
      return;
    }

    // Browser push notifications: overview + send
    if (route === 'push' || route.startsWith('push/')) {
      await handlePushRoutes(req, res, route);
      return;
    }

    if (req.method !== 'GET') {
      await delegateToExpress(req, res, route, query);
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

    // Dashboard sales analytics (owner view); profit only with the "reports" permission
    if (route === 'dashboard/sales' && req.method === 'GET') {
      const user = await requireStaff(req, res, ['dashboard']);
      if (!user) return;
      const { salesAnalytics, SALES_RANGES } = require('../../backend/dist/services/dashboard.service');
      const { hasPermission } = require('../../backend/dist/permissions');
      const raw = Number(query.days);
      const range = SALES_RANGES.includes(raw) ? raw : 14;
      const data = await salesAnalytics(range, hasPermission(user.role, 'reports'));
      sendJson(res, 200, { success: true, message: 'Success', data });
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

    await delegateToExpress(req, res, route, query);
  } catch (err) {
    console.error('Fast admin failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
