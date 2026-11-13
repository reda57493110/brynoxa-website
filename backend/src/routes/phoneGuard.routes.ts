import { Router, type Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { blockPhoneSchema } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { param } from '../utils/params';
import type { AuthRequest } from '../types/express';
import * as guard from '../services/phoneGuard.service';

/**
 * Fake-order protection: blocked numbers and a number's order history. On the live site these
 * reach Express through api/v1/admin.js (admin routes it does not handle are passed on).
 */
const router = Router();

router.get(
  '/admin/phone-history',
  requireAuth,
  requirePermission('orders:read'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await guard.phoneHistory(String(req.query.phone ?? ''), req.query.exclude ? String(req.query.exclude) : undefined));
  })
);
router.get(
  '/admin/blocked-phones',
  requireAuth,
  requirePermission('orders:read'),
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    sendSuccess(res, await guard.listBlocked());
  })
);
router.post(
  '/admin/blocked-phones',
  requireAuth,
  requirePermission('orders:write'),
  validate(blockPhoneSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const r = await guard.blockPhone(req.body, req.user?.userId);
    sendSuccess(res, r, r.already ? 'This number was already blocked' : 'Number blocked', r.already ? 200 : 201);
  })
);
router.delete(
  '/admin/blocked-phones/:id',
  requireAuth,
  requirePermission('orders:write'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await guard.unblockPhone(param(req, 'id'));
    sendSuccess(res, null, 'Number unblocked');
  })
);

export default router;
