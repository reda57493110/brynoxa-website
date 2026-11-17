import { Router, type Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { socialNumbersSchema } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { param } from '../utils/params';
import type { AuthRequest } from '../types/express';
import * as social from '../services/social.service';

/**
 * Admin → Social media (permission "ads": owner and Marketing): the numbers typed by staff.
 * On the live site these reach Express through api/v1/admin.js (admin routes it does not handle
 * are passed on).
 */
const router = Router();

router.get(
  '/admin/social',
  requireAuth,
  requirePermission('ads'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    sendSuccess(res, await social.overview());
  })
);
router.post(
  '/admin/social/numbers',
  requireAuth,
  requirePermission('ads'),
  validate(socialNumbersSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await social.saveNumbers(req.body), 'Numbers saved');
  })
);
router.delete(
  '/admin/social/numbers/:platform/:day',
  requireAuth,
  requirePermission('ads'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await social.deleteNumbers(param(req, 'platform'), param(req, 'day'));
    sendSuccess(res, null, 'Removed');
  })
);

export default router;
