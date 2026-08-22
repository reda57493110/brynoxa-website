import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/express';
import { verifyAccessToken } from '../utils/tokens';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { hasPermission, isStaffRole, type Permission } from '../permissions';

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
    req.user = { userId: user._id.toString(), role: user.role };
    next();
  } catch (err) {
    if (err instanceof ApiError) return next(err);
    next(new ApiError(401, 'Invalid or expired token'));
  }
}

/** Any staff role (not storefront customer). */
export function requireStaff(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user || !isStaffRole(req.user.role)) {
    return next(new ApiError(403, 'Staff access required'));
  }
  next();
}

/** @deprecated use requireStaff — kept for older imports */
export function requireAdmin(req: AuthRequest, _res: Response, next: NextFunction) {
  return requireStaff(req, _res, next);
}

export function requirePermission(...permissions: Permission[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user || !isStaffRole(req.user.role)) {
      return next(new ApiError(403, 'Staff access required'));
    }
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
      if (user && user.isActive && !user.isGuest) {
        req.user = { userId: user._id.toString(), role: user.role };
      }
    }
  } catch {
    // ignore
  }
  next();
}
