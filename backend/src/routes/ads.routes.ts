import { Router, type Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { adCampaignSchema, adSpendSchema, forUpdate } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { param } from '../utils/params';
import type { AuthRequest } from '../types/express';
import * as ads from '../services/ads.service';

/** Admin → Ads & social media (permission 'ads': owner and Marketing). On the live site these
 * reach Express through api/v1/admin.js (unknown admin routes are passed on). */
const router = Router();
const staff = [requireAuth, requirePermission('ads')];

const rangeOf = (raw: unknown): ads.AdRange => {
  const n = Number(raw);
  return (ads.AD_RANGES as readonly number[]).includes(n) ? (n as ads.AdRange) : 30;
};

router.get(
  '/admin/ads',
  ...staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await ads.adsOverview(rangeOf(req.query.days)));
  })
);
router.post(
  '/admin/ads',
  ...staff,
  validate(adCampaignSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await ads.createCampaign(req.body, req.user?.userId), 'Campaign added', 201);
  })
);
router.get(
  '/admin/ads/:id',
  ...staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await ads.campaignDetail(param(req, 'id')));
  })
);
router.patch(
  '/admin/ads/:id',
  ...staff,
  validate(forUpdate(adCampaignSchema)),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await ads.updateCampaign(param(req, 'id'), req.body), 'Campaign saved');
  })
);
router.delete(
  '/admin/ads/:id',
  ...staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ads.deleteCampaign(param(req, 'id'));
    sendSuccess(res, null, 'Campaign deleted');
  })
);
router.post(
  '/admin/ads/:id/spend',
  ...staff,
  validate(adSpendSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await ads.addSpend(param(req, 'id'), req.body, req.user?.userId), 'Spending added', 201);
  })
);
router.delete(
  '/admin/ads/:id/spend/:spendId',
  ...staff,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    await ads.deleteSpend(param(req, 'id'), param(req, 'spendId'));
    sendSuccess(res, null, 'Spending removed');
  })
);

export default router;
