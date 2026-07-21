import { Router } from 'express';
import * as auth from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { authLimiter } from '../middleware/rateLimit';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  addressSchema,
} from '../validators/schemas';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), auth.register);
router.post('/login', authLimiter, validate(loginSchema), auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', requireAuth, auth.logout);
router.get('/me', requireAuth, auth.me);
router.patch('/me', requireAuth, validate(updateProfileSchema), auth.updateProfile);
router.post('/me/addresses', requireAuth, validate(addressSchema), auth.addAddress);
router.patch('/me/addresses/:id', requireAuth, validate(addressSchema.partial()), auth.updateAddress);
router.delete('/me/addresses/:id', requireAuth, auth.deleteAddress);

export default router;
