const path = require('path');

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
  return pathname.replace(/^\/api\/v1\/auth\/?/, '').replace(/\/$/, '');
}

module.exports = async (req, res) => {
  const { pathname, query } = parseUrl(req.url || '');
  const route = resolveRoute(pathname, query);
  const [head, ...rest] = route.split('/').filter(Boolean);
  const action = head || '';

  // Preserve nested me/addresses paths for the me handler.
  if (action === 'me' && rest.length) {
    const nested = new URLSearchParams(query);
    nested.set('__route', rest.join('/'));
    req.url = `/api/v1/auth/me?${nested.toString()}`;
  } else if (action === 'me') {
    req.url = '/api/v1/auth/me';
  }

  const handlers = {
    login: () => require('../_lib/auth-routes/login'),
    csrf: () => require('../_lib/auth-routes/csrf'),
    refresh: () => require('../_lib/auth-routes/refresh'),
    me: () => require('../_lib/auth-routes/me'),
    logout: () => require('../_lib/auth-routes/logout'),
    'change-password': () => require('../_lib/auth-routes/change-password'),
  };

  const load = handlers[action];
  if (!load) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
    return;
  }

  return load()(req, res);
};
