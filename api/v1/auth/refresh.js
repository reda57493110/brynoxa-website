const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { connectMongo } = require('../../_lib/mongo');
const { sendJson } = require('../../_lib/http');

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

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

function csrfMatches(cookieToken, headerToken) {
  if (!cookieToken || !headerToken || cookieToken.length !== headerToken.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  } catch {
    return false;
  }
}

function setAuthCookies(res, refreshToken, csrfToken) {
  const secure = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60;
  const base = `Path=/api/v1/auth; ${secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=${maxAge}`;
  res.setHeader('Set-Cookie', [
    `brynoxa_refresh=${refreshToken}; HttpOnly; ${base}`,
    `brynoxa_csrf=${csrfToken}; ${base}`,
  ]);
}

function sanitizeUser(user) {
  return {
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
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const csrfCookie = cookies.brynoxa_csrf;
    const csrfHeader = req.headers['x-csrf-token'];
    if (!csrfMatches(csrfCookie, csrfHeader)) {
      sendJson(res, 403, { success: false, message: 'Invalid CSRF token' });
      return;
    }

    const cookieToken = cookies.brynoxa_refresh;
    if (!cookieToken) {
      sendJson(res, 401, { success: false, message: 'Refresh token missing' });
      return;
    }

    let payload;
    try {
      payload = jwt.verify(cookieToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      sendJson(res, 401, { success: false, message: 'Invalid refresh token' });
      return;
    }

    const conn = await connectMongo();
    const userId = payload.userId;
    let user = null;
    try {
      user = await conn.db.collection('users').findOne({ _id: new mongoose.Types.ObjectId(userId) });
    } catch {
      user = null;
    }

    if (!user || user.isActive === false) {
      sendJson(res, 401, { success: false, message: 'Session expired' });
      return;
    }

    if (user.refreshToken !== hashRefreshToken(cookieToken)) {
      await conn.db.collection('users').updateOne(
        { _id: user._id },
        { $unset: { refreshToken: '' } }
      );
      sendJson(res, 401, { success: false, message: 'Session expired' });
      return;
    }

    const nextPayload = { userId: user._id.toString(), role: user.role };
    const accessToken = jwt.sign(nextPayload, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });
    const refreshToken = jwt.sign(nextPayload, process.env.JWT_REFRESH_SECRET, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
    });

    await conn.db.collection('users').updateOne(
      { _id: user._id },
      { $set: { refreshToken: hashRefreshToken(refreshToken) } }
    );

    const csrfToken = csrfCookie || crypto.randomBytes(32).toString('hex');
    setAuthCookies(res, refreshToken, csrfToken);

    sendJson(res, 200, {
      success: true,
      message: 'Token refreshed',
      data: {
        user: sanitizeUser(user),
        accessToken,
      },
    });
  } catch (err) {
    console.error('Fast refresh failed:', err);
    sendJson(res, 500, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
