const path = require('path');
const Module = require('module');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { connectMongo } = require('../mongo');
const { sendJson, readJsonBody } = require('../http');

const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const STAFF_ROLES = new Set(['admin', 'orders', 'catalog', 'support', 'marketing']);

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function cookieSameSite() {
  return process.env.NODE_ENV === 'production' ? 'lax' : 'lax';
}

function setAuthCookies(res, refreshToken, csrfToken) {
  const secure = process.env.NODE_ENV === 'production';
  const sameSite = cookieSameSite();
  const maxAge = 7 * 24 * 60 * 60;
  const base = `Path=/api/v1/auth; ${secure ? 'Secure; ' : ''}SameSite=${sameSite}; Max-Age=${maxAge}`;
  res.setHeader('Set-Cookie', [
    `brynoxa_refresh=${refreshToken}; HttpOnly; ${base}`,
    `brynoxa_csrf=${csrfToken}; ${base}`,
  ]);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = String(body.email || '')
      .trim()
      .toLowerCase();
    const password = String(body.password || '');

    if (!email || !password) {
      sendJson(res, 400, { success: false, message: 'Email and password required' });
      return;
    }

    const conn = await connectMongo();
    const user = await conn.db.collection('users').findOne({ email });

    if (user?.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      sendJson(res, 429, { success: false, message: 'Account temporarily locked. Try again later.' });
      return;
    }

    if (!user?.password || !(await bcrypt.compare(password, user.password))) {
      sendJson(res, 401, { success: false, message: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      sendJson(res, 403, { success: false, message: 'Account is disabled' });
      return;
    }

    if (user.emailVerified === false) {
      sendJson(res, 403, { success: false, message: 'Please verify your email before signing in' });
      return;
    }

    if (user.mfaEnabled && STAFF_ROLES.has(user.role)) {
      const mfaToken = jwt.sign(
        { userId: user._id.toString(), purpose: 'mfa' },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: '5m' }
      );
      sendJson(res, 200, {
        success: true,
        message: 'MFA verification required',
        data: { mfaRequired: true, mfaToken },
      });
      return;
    }

    const payload = { userId: user._id.toString(), role: user.role };
    const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });
    const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
    });

    await conn.db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: { refreshToken: hashRefreshToken(refreshToken), failedLoginAttempts: 0 },
        $unset: { lockedUntil: '' },
      }
    );

    setAuthCookies(res, refreshToken, crypto.randomBytes(32).toString('hex'));

    sendJson(res, 200, {
      success: true,
      message: 'Logged in',
      data: {
        user: {
          _id: user._id,
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          addresses: user.addresses || [],
          avatar: user.avatar,
          isActive: user.isActive,
          isGuest: Boolean(user.isGuest),
          mfaEnabled: Boolean(user.mfaEnabled),
          createdAt: user.createdAt,
        },
        accessToken,
      },
    });
  } catch (err) {
    console.error('Fast login failed:', err);
    sendJson(res, 500, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
