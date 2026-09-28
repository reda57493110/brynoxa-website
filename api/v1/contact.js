const path = require('path');
const { connectMongo } = require('../_lib/mongo');
const { sendJson, readJsonBody } = require('../_lib/http');

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
  // /api/v1/contact → '' ; /api/v1/newsletter rewritten as __route=newsletter
  if (pathname.includes('/newsletter')) return 'newsletter';
  return pathname.replace(/^\/api\/v1\/contact\/?/, '').replace(/\/$/, '');
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

async function handlePushRoutes(req, res, route) {
  const pushService = require('../../backend/dist/services/push.service');

  if (route === 'push/public-key' && req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=300');
    sendJson(res, 200, {
      success: true,
      message: 'Success',
      data: { publicKey: pushService.getPushPublicKey() },
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  await connectMongo();
  const schemas = require('../../backend/dist/validators/schemas');
  const body = await readJsonBody(req);

  if (route === 'push/subscribe') {
    const data = parseBody(schemas.pushSubscribeSchema, body);
    const { optionalUser } = require('../_lib/auth');
    const { getUserAgent } = require('../../backend/dist/utils/requestMeta');
    const user = await optionalUser(req).catch(() => null);
    await pushService.saveSubscription({
      subscription: data.subscription,
      locale: data.locale,
      userId: user ? String(user._id) : undefined,
      userAgent: getUserAgent(req),
    });
    sendJson(res, 201, { success: true, message: 'Subscribed', data: null });
    return;
  }

  if (route === 'push/unsubscribe') {
    const data = parseBody(schemas.pushUnsubscribeSchema, body);
    await pushService.removeSubscription(data.endpoint);
    sendJson(res, 200, { success: true, message: 'Unsubscribed', data: null });
    return;
  }

  sendJson(res, 404, { success: false, message: 'Not found' });
}

module.exports = async (req, res) => {
  try {
    const { pathname, query } = parseUrl(req.url || '');
    const route = resolveRoute(pathname, query);

    if (route.startsWith('push/')) {
      await handlePushRoutes(req, res, route);
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { success: false, message: 'Method not allowed' });
      return;
    }

    await connectMongo();

    const schemas = require('../../backend/dist/validators/schemas');
    const { ContactMessage, NewsletterSubscriber } = require('../../backend/dist/models/Contact');
    const body = await readJsonBody(req);

    // POST /newsletter
    if (route === 'newsletter') {
      const data = parseBody(schemas.newsletterSchema, body);
      const email = String(data.email).toLowerCase();
      const existing = await NewsletterSubscriber.findOne({ email });
      if (existing) {
        if (!existing.isActive) {
          existing.isActive = true;
          await existing.save();
        }
        sendJson(res, 200, { success: true, message: 'Already subscribed', data: { email } });
        return;
      }
      await NewsletterSubscriber.create({ email });
      sendJson(res, 201, { success: true, message: 'Subscribed', data: { email } });
      return;
    }

    // POST /contact
    if (!route) {
      const data = parseBody(schemas.contactSchema, body);
      const doc = await ContactMessage.create(data);
      sendJson(res, 201, {
        success: true,
        message: 'Message received',
        data: { id: doc._id },
      });
      return;
    }

    sendJson(res, 404, { success: false, message: 'Not found' });
  } catch (err) {
    console.error('Fast contact failed:', err);
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
