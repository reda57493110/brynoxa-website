import { Router, type Request, type Response } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { socialReplySchema } from '../validators/schemas';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { param } from '../utils/params';
import type { AuthRequest } from '../types/express';
import * as social from '../services/social.service';

/**
 * Admin → Social media. Seeing numbers and messages: permission "ads" (owner, Marketing).
 * Connecting / disconnecting accounts: the owner ("settings"). Meta / TikTok send the owner back to
 * /social/<platform>/callback (no sign-in there: the signed state names the owner). On the live
 * site these reach Express through api/v1/admin.js and the api/index.js catch-all.
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
  '/admin/social/:platform/connect',
  requireAuth,
  requirePermission('settings'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const platform = param(req, 'platform');
    if (platform !== 'meta' && platform !== 'tiktok') return sendSuccess(res, null, 'Unknown platform', 404);
    sendSuccess(res, { url: social.connectUrl(platform, req.user!.userId) });
  })
);
router.delete(
  '/admin/social/:platform',
  requireAuth,
  requirePermission('settings'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const platform = param(req, 'platform');
    if (platform !== 'meta' && platform !== 'tiktok') return sendSuccess(res, null, 'Unknown platform', 404);
    await social.disconnect(platform);
    sendSuccess(res, null, 'Disconnected');
  })
);
router.get(
  '/admin/social/inbox/:platform',
  requireAuth,
  requirePermission('ads'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const platform = param(req, 'platform') === 'instagram' ? 'instagram' : 'facebook';
    sendSuccess(res, await social.conversations(platform));
  })
);
router.get(
  '/admin/social/thread/:id',
  requireAuth,
  requirePermission('ads'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await social.thread(param(req, 'id')));
  })
);
router.post(
  '/admin/social/reply',
  requireAuth,
  requirePermission('ads'),
  validate(socialReplySchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, await social.reply(req.body), 'Message sent');
  })
);

// Meta / TikTok send the owner back here after Connect (a plain browser visit)
router.get(
  '/social/meta/callback',
  asyncHandler(async (req: Request, res: Response) => {
    res.redirect(302, await social.metaCallback(req.query));
  })
);
router.get(
  '/social/tiktok/callback',
  asyncHandler(async (req: Request, res: Response) => {
    res.redirect(302, await social.tiktokCallback(req.query));
  })
);

export default router;
