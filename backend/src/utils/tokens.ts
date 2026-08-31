import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { Types } from 'mongoose';
import type { AppRole } from '../permissions';

export type TokenPayload = {
  userId: string;
  role: AppRole;
};

export type MfaChallengePayload = {
  userId: string;
  purpose: 'mfa';
};

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

export function signMfaChallenge(userId: string): string {
  return jwt.sign({ userId, purpose: 'mfa' }, env.JWT_ACCESS_SECRET, { expiresIn: '5m' });
}

export function verifyMfaChallenge(token: string): MfaChallengePayload {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as MfaChallengePayload;
  if (payload.purpose !== 'mfa' || !payload.userId) throw new Error('Invalid MFA challenge');
  return payload;
}

export function toObjectIdString(id: Types.ObjectId | string): string {
  return typeof id === 'string' ? id : id.toString();
}
