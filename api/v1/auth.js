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

const ACCOUNT_ACTIONS = new Set([
  'register',
  'password-reset/request',
  'password-reset/confirm',
  'verification/resend',
  'verification/confirm',
  'mfa/login',
]);

const MFA_MANAGE_ACTIONS = new Set(['mfa/setup', 'mfa/verify', 'mfa/disable']);

module.exports = async (req, res) => {
  const { pathname, query } = parseUrl(req.url || '');
  const route = resolveRoute(pathname, query);
  const parts = route.split('/').filter(Boolean);
  const head = parts[0] || '';
  const nested = parts.slice(1).join('/');
  const fullAction = nested ? `${head}/${nested}` : head;

  // Preserve nested me/addresses paths for the me handler.
  if (head === 'me' && nested) {
    const nestedQs = new URLSearchParams(query);
    nestedQs.set('__route', nested);
    req.url = `/api/v1/auth/me?${nestedQs.toString()}`;
  } else if (head === 'me') {
    req.url = '/api/v1/auth/me';
  }

  if (ACCOUNT_ACTIONS.has(fullAction)) {
    req.__authAction = fullAction;
    return require('../_lib/auth-routes/account')(req, res);
  }

  if (MFA_MANAGE_ACTIONS.has(fullAction)) {
    req.__authAction = fullAction;
    return require('../_lib/auth-routes/mfa')(req, res);
  }

  const handlers = {
    login: () => require('../_lib/auth-routes/login'),
    csrf: () => require('../_lib/auth-routes/csrf'),
    refresh: () => require('../_lib/auth-routes/refresh'),
    me: () => require('../_lib/auth-routes/me'),
    logout: () => require('../_lib/auth-routes/logout'),
    'change-password': () => require('../_lib/auth-routes/change-password'),
  };

  const load = handlers[head];
  if (!load) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
    return;
  }

  return load()(req, res);
};
