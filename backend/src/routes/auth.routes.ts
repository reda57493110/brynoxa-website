import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requireStaff } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  mfaCodeSchema,
  mfaLoginSchema,
  changePasswordSchema,
  emailSchema,
  verifyEmailSchema,
  resetPasswordSchema,
  addressSchema,
} from '../validators/schemas';

const router = Router();

router.get('/csrf', auth.csrf);
router.post('/password-reset/request', authLimiter, validate(emailSchema), auth.requestPasswordReset);
router.post('/verification/resend', authLimiter, validate(emailSchema), auth.resendVerification);
router.post('/verification/confirm', authLimiter, validate(verifyEmailSchema), auth.verifyEmail);
router.post('/password-reset/confirm', authLimiter, validate(resetPasswordSchema), auth.resetPassword);
router.post('/register', authLimiter, validate(registerSchema), auth.register);
router.post('/login', authLimiter, validate(loginSchema), auth.login);
router.post('/mfa/login', authLimiter, validate(mfaLoginSchema), auth.completeMfaLogin);
router.post('/refresh', auth.refresh);
router.post('/logout', requireAuth, auth.logout);
router.post('/change-password', requireAuth, validate(changePasswordSchema), auth.changePassword);
router.post('/mfa/setup', requireAuth, requireStaff, auth.setupMfa);
router.post('/mfa/verify', requireAuth, requireStaff, validate(mfaCodeSchema), auth.verifyMfaSetup);
router.post('/mfa/disable', requireAuth, requireStaff, validate(mfaCodeSchema), auth.disableMfa);
router.get('/me', requireAuth, auth.me);
router.patch('/me', requireAuth, validate(updateProfileSchema), auth.updateProfile);
router.post('/me/addresses', requireAuth, validate(addressSchema), auth.addAddress);
router.patch('/me/addresses/:id', requireAuth, validate(addressSchema.partial()), auth.updateAddress);
router.delete('/me/addresses/:id', requireAuth, auth.deleteAddress);

export default router;
