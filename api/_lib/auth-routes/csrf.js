const crypto = require('crypto');
const { sendJson } = require('../http');

function parseCookies(header = '') {
  const out = {};
  for (const part of String(header).split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function setCsrfCookie(res, csrfToken) {
  const secure = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60;
  res.setHeader(
    'Set-Cookie',
    `brynoxa_csrf=${csrfToken}; Path=/api/v1/auth; ${secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${maxAge}`
  );
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const csrfToken = cookies.brynoxa_csrf || crypto.randomBytes(32).toString('hex');
    setCsrfCookie(res, csrfToken);
    sendJson(res, 200, {
      success: true,
      message: 'CSRF token issued',
      data: { csrfToken },
    });
  } catch (err) {
    console.error('Fast CSRF failed:', err);
    sendJson(res, 500, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
