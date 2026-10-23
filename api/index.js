const path = require('path');

const backendNodeModules = path.join(__dirname, '../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const { getApp } = require('../backend/dist/app');

/**
 * Catch-all for /api/v1 routes without a dedicated function. vercel.json rewrites them to
 * /api?__path=<rest>; rebuild the original URL and hand the request straight to Express
 * (an Express app is a plain Node request handler, so no adapter is needed).
 */
/**
 * Routes that have their own function (see vercel.json rewrites), with shared rate limits that
 * Express does not have. This catch-all must never serve them: otherwise /api?__path=orders,
 * /api?__path=coupons/validate or /api?__path=auth/login would skip those limits.
 */
const DEDICATED = [
  /^(brands|notifications|admin|products|categories|orders|wishlist)(\/|$)/,
  /^images\//,
  /^coupons\/validate$/,
  /^newsletter$/,
  /^push\/(public-key|subscribe|unsubscribe|click)$/,
  /^auth\/(me|password-reset|verification)(\/|$)/,
  /^auth\/mfa\/(login|setup|verify|disable)$/,
  /^auth\/(login|csrf|refresh|logout|change-password|register)$/,
  /^(health|auth|settings|contact)$/,
];

/** True when the path is one this catch-all is not allowed to serve. */
function isBlockedPath(rest) {
  // Encoded or dotted paths could reach the same Express route under another spelling
  if (/[%\\]|\.\./.test(rest)) return true;
  // Express matches routes case-insensitively and ignores repeated or trailing slashes
  const clean = rest.toLowerCase().replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
  return DEDICATED.some((rx) => rx.test(clean));
}

function restoreUrl(req) {
  const [pathname, queryString = ''] = (req.url || '').split('?');
  const params = new URLSearchParams(queryString);
  const rest = params.get('__path');
  params.delete('__path');
  if (rest === null && pathname.startsWith('/api/v1')) return true;
  if (rest && isBlockedPath(rest)) return false;
  const qs = params.toString();
  req.url = `/api/v1${rest ? `/${rest.replace(/^\/+/, '')}` : ''}${qs ? `?${qs}` : ''}`;
  return true;
}

module.exports = (req, res) =>
  new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    try {
      if (!restoreUrl(req)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, message: 'Not found' }));
        return;
      }
      getApp()(req, res);
    } catch (err) {
      console.error('API request failed:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, message: 'Server error' }));
    }
  });

module.exports.isBlockedPath = isBlockedPath;
