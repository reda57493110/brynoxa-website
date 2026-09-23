const crypto = require('crypto');

function cookieBase(maxAgeSeconds) {
  const secure = process.env.NODE_ENV === 'production';
  const maxAge =
    maxAgeSeconds === 0 ? 'Max-Age=0' : `Max-Age=${maxAgeSeconds ?? 7 * 24 * 60 * 60}`;
  return `Path=/api/v1/auth; ${secure ? 'Secure; ' : ''}SameSite=Lax; ${maxAge}`;
}

function setAuthCookies(res, refreshToken, csrfToken) {
  const base = cookieBase();
  res.setHeader('Set-Cookie', [
    `brynoxa_refresh=${refreshToken}; HttpOnly; ${base}`,
    `brynoxa_csrf=${csrfToken || crypto.randomBytes(32).toString('hex')}; ${base}`,
  ]);
}

function clearAuthCookies(res) {
  const base = cookieBase(0);
  res.setHeader('Set-Cookie', [
    `brynoxa_refresh=; HttpOnly; ${base}`,
    `brynoxa_csrf=; ${base}`,
  ]);
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

module.exports = { setAuthCookies, clearAuthCookies, parseBody };
