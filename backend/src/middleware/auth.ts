import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { verifyAccessToken } from '../utils/tokens';
import { issuedBeforePasswordChange } from '../utils/tokenFreshness';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { hasPermission, isStaffRole, type Permission } from '../permissions';
import { MFA_REQUIRED_CODE, MFA_REQUIRED_MESSAGE, mfaSetupOverdue } from '../utils/mfaPolicy';
import { trackStaffRequest } from '../services/staffActivity.service';

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new ApiError(401, 'Authentication required');
    }
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new ApiError(401, 'User not found or inactive');
    }
    if (issuedBeforePasswordChange(payload, user)) {
      throw new ApiError(401, 'Session ended after a password change — please sign in again');
    }
    req.user = { userId: user._id.toString(), role: user.role, mfaOverdue: mfaSetupOverdue(user) };
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

const mfaRequired = () => new ApiError(403, MFA_REQUIRED_MESSAGE, undefined, MFA_REQUIRED_CODE);

/** Any staff role (not storefront customer), with 2-step on once the grace period is over. */
export function requireStaff(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || !isStaffRole(req.user.role)) {
    return next(new ApiError(403, 'Staff access required'));
  }
  if (req.user.mfaOverdue) return next(mfaRequired());
  // Changes that succeed go to the staff activity log (Admin → Roles)
  trackStaffRequest(req, res, { id: req.user.userId, role: req.user.role });
  next();
}

/** Staff role only, no 2-step requirement: the pages that set 2-step up. */
export function requireStaffRole(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || !isStaffRole(req.user.role)) {
    return next(new ApiError(403, 'Staff access required'));
  }
  next();
}

export function requirePermission(...permissions: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !isStaffRole(req.user.role)) {
      return next(new ApiError(403, 'Staff access required'));
    }
    if (req.user.mfaOverdue) return next(mfaRequired());
    const ok = permissions.some((p) => hasPermission(req.user!.role, p));
    if (!ok) {
      return next(new ApiError(403, 'You do not have permission for this action'));
    }
    trackStaffRequest(req, res, { id: req.user.userId, role: req.user.role });
    next();
  };
}

/** Where products show in the shop: the settings catalog staff may change (Products page, product form). */
export const STOREFRONT_SETTINGS = ['homeDeals', 'pageHeroProducts'] as const;

/**
 * After requirePermission('settings', 'products:write'): the owner changes any setting; catalog
 * staff only the storefront placements (home deals, shop page header product).
 */
export function onlyStorefrontUnlessSettings(req: AuthRequest, _res: Response, next: NextFunction) {
  if (hasPermission(req.user?.role, 'settings')) return next();
  const keys = Object.keys((req.body as Record<string, unknown> | undefined) ?? {});
  if (keys.length && keys.every((k) => (STOREFRONT_SETTINGS as readonly string[]).includes(k))) return next();
  next(new ApiError(403, 'You do not have permission for this action'));
}

/**
 * After optionalAuth on order placement: a signed-in customer (the form sends no email) whose
 * sign-in expired gets 401, so the shop renews the session and sends the order again instead of
 * it failing as a guest order without an email.
 */
export function refuseExpiredSession(req: AuthRequest, _res: Response, next: NextFunction) {
  const bearer = String(req.headers.authorization || '').startsWith('Bearer ');
  if (bearer && !req.user && !(req.body as { email?: string } | undefined)?.email) {
    return next(new ApiError(401, 'Session expired'));
  }
  next();
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const payload = verifyAccessToken(header.slice(7));
      const user = await User.findById(payload.userId);
      if (user && user.isActive && !user.isGuest && !issuedBeforePasswordChange(payload, user)) {
        req.user = { userId: user._id.toString(), role: user.role };
      }
    }
  } catch {
    // ignore
  }
  next();
}
