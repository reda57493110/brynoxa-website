import { Request } from 'express';
import type { AppRole } from '../permissions';

export type UserRole = AppRole;

export interface AuthUser {
  userId: string;
  role: UserRole;
  /** Staff whose 2-step grace period is over without 2-step on (see utils/mfaPolicy). */
  mfaOverdue?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export {};
