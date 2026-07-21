import { Request } from 'express';

export type UserRole = 'customer' | 'admin';

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
