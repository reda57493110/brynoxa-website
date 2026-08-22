import { Request } from 'express';
import type { AppRole } from '../permissions';

export type UserRole = AppRole;

export interface AuthUser {
  userId: string;
  role: UserRole;
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
