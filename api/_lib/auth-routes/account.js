const path = require('path');
const { connectMongo } = require('../mongo');
const { sendJson, readJsonBody } = require('../http');
const { setAuthCookies, clearAuthCookies, parseBody } = require('./cookies');

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
      const result = await authService.completeMfaLogin(data.mfaToken, data.code);
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
    const status = err?.statusCode || 500;
    sendJson(res, status, {
      success: false,
      message: err instanceof Error ? err.message : 'Server error',
    });
  }
};
