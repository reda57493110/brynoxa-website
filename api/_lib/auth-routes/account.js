const path = require('path');
const { connectMongo } = require('../mongo');
const { sendJson, readJsonBody, sendError } = require('../http');
const { setAuthCookies, clearAuthCookies, parseBody } = require('./cookies');
const { rateLimit } = require('../rateLimit');

// Which limit each action counts against; emails are also limited per address
const ACTION_LIMITS = {
  register: 'register',
  'password-reset/request': 'emailSend',
  'verification/resend': 'emailSend',
  'password-reset/confirm': 'emailLink',
  'password-reset/verify-code': 'emailLink',
  'verification/confirm': 'emailLink',
  'mfa/login': 'mfa',
};

const backendNodeModules = path.join(__dirname, '../../../backend/node_modules');
if (!module.paths.includes(backendNodeModules)) {
  module.paths.unshift(backendNodeModules);
}

/**
 * Handles register, password-reset/*, verification/*, and mfa/login.
 * Nested path comes from auth.js as req.__authAction (e.g. "password-reset/request").
 */
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { success: false, message: 'Method not allowed' });
    return;
  }

  try {
    await connectMongo();
    const action = req.__authAction || '';
    const authService = require('../../../backend/dist/services/auth.service');
    const schemas = require('../../../backend/dist/validators/schemas');
    const body = await readJsonBody(req);

    const limit = ACTION_LIMITS[action];
    // Actions that send an email to an address are also limited per address
    let perKey = (limit === 'emailSend' || action === 'register' || action === 'password-reset/verify-code') && typeof body?.email === 'string' ? body.email : undefined;
    if (action === 'mfa/login' && typeof body?.mfaToken === 'string') {
      // Count code tries per account (from any address) and per sign-in challenge; the token is
      // checked properly afterwards, here it only names the account / the challenge
      const crypto = require('crypto');
      const jwt = require('jsonwebtoken');
      const claimed = jwt.decode(body.mfaToken);
      perKey = claimed && typeof claimed.userId === 'string' ? `user:${claimed.userId}` : undefined;
      const challenge = crypto.createHash('sha256').update(body.mfaToken).digest('hex');
      if (!(await rateLimit(req, res, 'mfaChallenge', challenge, { perIp: false }))) return;
    }
    if (limit && !(await rateLimit(req, res, limit, perKey))) return;

    if (action === 'register') {
      const data = parseBody(schemas.registerSchema, body);
      const result = await authService.registerUser(data);
      if ('verificationRequired' in result) {
        sendJson(res, 201, {
          success: true,
          message: 'Verification email sent',
          data: result,
        });
        return;
      }
      setAuthCookies(res, result.refreshToken);
      sendJson(res, 201, {
        success: true,
        message: 'Registered',
        data: { user: result.user, accessToken: result.accessToken },
      });
      return;
    }

    if (action === 'password-reset/request') {
      const data = parseBody(schemas.emailSchema, body);
      await authService.requestPasswordReset(data.email);
      sendJson(res, 200, {
        success: true,
        message: 'If that account exists, a reset email has been sent',
        data: null,
      });
      return;
    }

    if (action === 'password-reset/verify-code') {
      const data = parseBody(schemas.resetCodeSchema, body);
      const result = await authService.verifyPasswordResetCode(data.email, data.code);
      sendJson(res, 200, { success: true, message: 'Code accepted', data: result });
      return;
    }

    if (action === 'password-reset/confirm') {
      const data = parseBody(schemas.resetPasswordSchema, body);
      await authService.resetPassword(data.token, data.newPassword);
      clearAuthCookies(res);
      sendJson(res, 200, {
        success: true,
        message: 'Password reset; please sign in',
        data: null,
      });
      return;
    }

    if (action === 'verification/resend') {
      const data = parseBody(schemas.emailSchema, body);
      await authService.resendVerificationEmail(data.email);
      sendJson(res, 200, {
        success: true,
        message: 'If verification is needed, an email has been sent',
        data: null,
      });
      return;
    }

    if (action === 'verification/confirm') {
      const data = parseBody(schemas.verifyEmailSchema, body);
      await authService.verifyEmail(data.token);
      sendJson(res, 200, {
        success: true,
        message: 'Email verified',
        data: null,
      });
      return;
    }

    if (action === 'mfa/login') {
      const data = parseBody(schemas.mfaLoginSchema, body);
      const { getRequestMeta } = require('../../../backend/dist/utils/requestMeta');
      const result = await authService.completeMfaLogin(
        data.mfaToken,
        data.code,
        getRequestMeta(req)
      );
      setAuthCookies(res, result.refreshToken);
      sendJson(res, 200, {
        success: true,
        message: 'Logged in',
        data: { user: result.user, accessToken: result.accessToken },
      });
      return;
    }

    sendJson(res, 404, { success: false, message: 'Not found' });
  } catch (err) {
    console.error('Fast auth account flow failed:', err);
    sendError(res, err);
  }
};
