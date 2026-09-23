const path = require('path');
const crypto = require('crypto');
const { connectMongo } = require('../_lib/mongo');
const { sendJson, readJsonBody } = require('../_lib/http');
const { optionalUser, requireUser } = require('../_lib/auth');

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
  return pathname.replace(/^\/api\/v1\/orders\/?/, '').replace(/\/$/, '');
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

function cookieSameSite() {
  return 'lax';
}

function setAuthCookies(res, refreshToken) {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = cookieSameSite();
  const maxAge = 7 * 24 * 60 * 60;
  const csrfToken = crypto.randomBytes(32).toString('hex');
  const base = `Path=/api/v1/auth; ${secure ? 'Secure; ' : ''}SameSite=${sameSite}; Max-Age=${maxAge}`;
  res.setHeader('Set-Cookie', [
    `brynoxa_refresh=${refreshToken}; HttpOnly; ${base}`,
    `brynoxa_csrf=${csrfToken}; ${base}`,
  ]);
}

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues?.[0]?.message || 'Validation failed';
    const err = new Error(message);
    err.statusCode = 400;
    err.errors = parsed.error.issues;
    throw err;
  }
  return parsed.data;
}

module.exports = async (req, res) => {
  try {
    await connectMongo();

    const { pathname, query } = parseUrl(req.url || '');
    const route = resolveRoute(pathname, query);
    const orderService = require('../../backend/dist/services/order.service');
    const authService = require('../../backend/dist/services/auth.service');
    const schemas = require('../../backend/dist/validators/schemas');

    // Checkout helper routed here: POST /coupons/validate
    if (route === 'coupons/validate' && req.method === 'POST') {
      const body = parseBody(schemas.validateCouponSchema, await readJsonBody(req));
      const { coupon, discount } = await orderService.validateCoupon(body.code, body.subtotal);
      sendJson(res, 200, {
        success: true,
        message: 'Success',
        data: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          discount,
        },
      });
      return;
    }

    // POST /orders/track — guest lookup by order number + phone
    if (route === 'track' && req.method === 'POST') {
      const body = parseBody(schemas.trackOrderSchema, await readJsonBody(req));
      const order = await orderService.trackGuestOrder(body.orderNumber, body.phone);
      sendJson(res, 200, { success: true, message: 'Success', data: order });
      return;
    }

    // POST /orders — place COD order (guest or logged-in)
    if (!route && req.method === 'POST') {
      const body = parseBody(schemas.createOrderSchema, await readJsonBody(req));
      const user = await optionalUser(req);
      const shippingAddress = body.shippingAddress;

      const { userId, auth } = await authService.resolveCheckoutCustomer({
        // Match Express optionalAuth: guest sessions do not count as signed-in checkout.
        authenticatedUserId: user && !user.isGuest ? user._id.toString() : undefined,
        email: body.email,
        name: shippingAddress.fullName,
        phone: shippingAddress.phone,
        password: body.password,
        shippingAddress,
      });

      const result = await orderService.createCodOrder({
        userId,
        items: body.items,
        shippingAddress,
        couponCode: body.couponCode,
        customerNote: body.customerNote,
      });

      if (auth) {
        setAuthCookies(res, auth.refreshToken);
        sendJson(res, 201, {
          success: true,
          message: 'Order placed',
          data: { order: result.order, user: auth.user, accessToken: auth.accessToken },
        });
        return;
      }

      sendJson(res, 201, {
        success: true,
        message: 'Order placed',
        data: { order: result.order, receiptToken: result.receiptToken },
      });
      return;
    }

    // GET /orders — my orders
    if (!route && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      const page = Number(query.page || 1);
      const limit = Number(query.limit || 10);
      const result = await orderService.listUserOrders(user._id.toString(), page, limit);
      sendJson(res, 200, paginated(result.items, result.page, result.limit, result.total));
      return;
    }

    // Nested: /orders/:orderNumber[/action]
    const parts = route.split('/').filter(Boolean);
    if (parts.length >= 1) {
      const orderNumber = parts[0];
      const action = parts[1] || '';

      if (action === 'receipt' && req.method === 'POST') {
        const body = parseBody(schemas.guestOrderReceiptSchema, await readJsonBody(req));
        const order = await orderService.getGuestOrderReceipt(orderNumber, body.token);
        sendJson(res, 200, { success: true, message: 'Success', data: order });
        return;
      }

      if (action === 'cancel' && req.method === 'POST') {
        const user = await requireUser(req, res);
        if (!user) return;
        const order = await orderService.cancelUserOrder(user._id.toString(), orderNumber);
        sendJson(res, 200, { success: true, message: 'Order cancelled', data: order });
        return;
      }

      if (action === 'items' && req.method === 'PATCH') {
        const user = await requireUser(req, res);
        if (!user) return;
        const body = parseBody(schemas.updateOrderItemsSchema, await readJsonBody(req));
        const order = await orderService.updateUserOrderItems(
          user._id.toString(),
          orderNumber,
          body.items
        );
        sendJson(res, 200, { success: true, message: 'Order updated', data: order });
        return;
      }

      if (!action && req.method === 'GET') {
        const user = await requireUser(req, res);
        if (!user) return;
        const order = await orderService.getUserOrder(user._id.toString(), orderNumber);
        sendJson(res, 200, { success: true, message: 'Success', data: order });
        return;
      }
    }

    sendJson(res, 405, { success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Fast orders failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
      ...(err?.errors ? { errors: err.errors } : {}),
    });
  }
};
