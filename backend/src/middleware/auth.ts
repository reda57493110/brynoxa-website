import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { verifyAccessToken } from '../utils/tokens';
import { issuedBeforePasswordChange } from '../utils/tokenFreshness';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { hasPermission, isStaffRole, type Permission } from '../permissions';
import { MFA_REQUIRED_CODE, MFA_REQUIRED_MESSAGE, mfaSetupOverdue } from '../utils/mfaPolicy';

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
export function requireStaff(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || !isStaffRole(req.user.role)) {
    return next(new ApiError(403, 'Staff access required'));
  }
  if (req.user.mfaOverdue) return next(mfaRequired());
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
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !isStaffRole(req.user.role)) {
      return next(new ApiError(403, 'Staff access required'));
    }
    if (req.user.mfaOverdue) return next(mfaRequired());
    const ok = permissions.some((p) => hasPermission(req.user!.role, p));
    if (!ok) {
      return next(new ApiError(403, 'You do not have permission for this action'));
    }
    next();
  };
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
