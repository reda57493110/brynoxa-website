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
function restoreUrl(req) {
  const [pathname, queryString = ''] = (req.url || '').split('?');
  const params = new URLSearchParams(queryString);
  const rest = params.get('__path');
  params.delete('__path');
  if (rest === null && pathname.startsWith('/api/v1')) return;
  const qs = params.toString();
  req.url = `/api/v1${rest ? `/${rest.replace(/^\/+/, '')}` : ''}${qs ? `?${qs}` : ''}`;
}

module.exports = (req, res) =>
  new Promise((resolve) => {
    res.on('finish', resolve);
    res.on('close', resolve);
    try {
      restoreUrl(req);
      getApp()(req, res);
    } catch (err) {
      console.error('API request failed:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, message: 'Server error' }));
    }
  });
