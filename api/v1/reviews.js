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
  return pathname.replace(/^\/api\/v1\/reviews\/?/, '').replace(/\/$/, '');
}

function parseBody(schema, body) {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues?.[0]?.message || 'Validation failed';
    const err = new Error(message);
    err.statusCode = 400;
    throw err;
  }
  return parsed.data;
}

module.exports = async (req, res) => {
  try {
    await connectMongo();

    const { pathname, query } = parseUrl(req.url || '');
    const route = resolveRoute(pathname, query);
    const reviewService = require('../../backend/dist/services/review.service');
    const schemas = require('../../backend/dist/validators/schemas');

    // GET /reviews/me
    if (route === 'me' && req.method === 'GET') {
      const user = await requireUser(req, res);
      if (!user) return;
      const items = await reviewService.listUserReviews(user._id.toString());
      sendJson(res, 200, { success: true, message: 'Success', data: items });
      return;
    }

    // POST /reviews
    if (!route && req.method === 'POST') {
      const user = await requireUser(req, res);
      if (!user) return;
      const body = parseBody(schemas.reviewSchema, await readJsonBody(req));
      const result = await reviewService.createReview({
        userId: user._id.toString(),
        productId: body.productId,
        rating: body.rating,
        title: body.title,
        comment: body.comment,
      });
      // Match Express controller payload shape
      sendJson(res, 201, {
        success: true,
        message: 'Review submitted',
        data: result,
      });
      return;
    }

    sendJson(res, 405, { success: false, message: 'Method not allowed' });
  } catch (err) {
    console.error('Fast reviews failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
