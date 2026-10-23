const path = require('path');
const Module = require('module');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { connectMongo } = require('../mongo');
const { sendJson, readJsonBody } = require('../http');
const { rateLimit } = require('../rateLimit');
const { isPublishedDefaultPassword } = require('../../../backend/dist/utils/blockedPasswords');
const { checkPasswordEvenTime } = require('../../../backend/dist/utils/passwordTiming');

const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

const STAFF_ROLES = new Set(['admin', 'orders', 'catalog', 'support', 'marketing']);

// Same as backend auth.service: 5 wrong passwords lock the account for 15 minutes
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000;

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

    if (!(await rateLimit(req, res, 'login', email))) return;

    const conn = await connectMongo();
    const user = await conn.db.collection('users').findOne({ email });

    // Always checked, with the same cost (a dummy when the email is unknown, and also while locked),
    // so the time taken never tells whether an email has an account
    const passwordMatches = await checkPasswordEvenTime(password, user?.password);

    if (user?.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      sendJson(res, 429, { success: false, message: 'Account temporarily locked. Try again later.' });
      return;
    }

    // The old published default never signs anyone in (counted as a wrong password)
    const passwordOk = passwordMatches && !isPublishedDefaultPassword(password);
    if (!user?.password || !passwordOk) {
      if (user) {
        // Count the failure; lock the account after too many
        const updated = await conn.db
          .collection('users')
          .findOneAndUpdate({ _id: user._id }, { $inc: { failedLoginAttempts: 1 } }, { returnDocument: 'after' });
        const after = updated && typeof updated.failedLoginAttempts === 'number' ? updated : updated?.value;
        if ((after?.failedLoginAttempts || 0) >= MAX_LOGIN_ATTEMPTS) {
          await conn.db
            .collection('users')
            .updateOne({ _id: user._id }, { $set: { lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_MS), failedLoginAttempts: 0 } });
        }
      }
      sendJson(res, 401, { success: false, message: 'Invalid email or password' });
      return;
    }

    if (!user.isActive) {
      sendJson(res, 403, { success: false, message: 'Account is disabled' });
      return;
    }

    if (user.emailVerified === false && STAFF_ROLES.has(user.role)) {
      sendJson(res, 403, { success: false, message: 'Please verify your email before signing in' });
      return;
    }

    if (user.mfaEnabled && STAFF_ROLES.has(user.role)) {
      const mfaToken = jwt.sign(
        { userId: user._id.toString(), purpose: 'mfa' },
        // Own key so it can never pass as an access token (same as backend utils/tokens.ts)
        `${process.env.JWT_ACCESS_SECRET}:mfa-challenge`,
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
        // Same user details as /me and auto sign-in (incl. wholesale status)
        user: { ...require('../../../backend/dist/services/auth.service').sanitizeUser(user), addresses: user.addresses || [] },
        accessToken,
      },
    });

    if (STAFF_ROLES.has(user.role)) {
      setTimeout(() => {
        try {
          const { notifyAdminStaffLogin } = require('../../../backend/dist/services/loginNotify.service');
          const { getRequestMeta } = require('../../../backend/dist/utils/requestMeta');
          notifyAdminStaffLogin(
            { name: user.name, email: user.email, role: user.role, phone: user.phone },
            getRequestMeta(req)
          );
        } catch (notifyErr) {
          console.error('Staff login notify failed:', notifyErr);
        }
      }, 0);
    }
  } catch (err) {
    console.error('Fast login failed:', err);
    sendJson(res, 500, { success: false, message: 'Sign in temporarily unavailable. Please try again in a moment.' });
  }
};
