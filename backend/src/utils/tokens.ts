import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { AppRole } from '../permissions';

export type TokenPayload = {
  userId: string;
  role: AppRole;
  /** Issued at (seconds), set by jsonwebtoken */
  iat?: number;
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
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as TokenPayload & { purpose?: string };
  // A step token (e.g. the MFA challenge) is never a login
  if (payload.purpose || !payload.userId) throw new Error('Not an access token');
  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
}

/**
 * MFA challenge tokens use their own key (derived from the access secret) so they can never be
 * accepted as an access token. Mirrored in api/_lib/auth-routes/login.js.
 */
const mfaSecret = () => `${env.JWT_ACCESS_SECRET}:mfa-challenge`;

export function signMfaChallenge(userId: string): string {
  return jwt.sign({ userId, purpose: 'mfa' }, mfaSecret(), { expiresIn: '5m' });
}

export function verifyMfaChallenge(token: string): MfaChallengePayload {
  const payload = jwt.verify(token, mfaSecret(), { algorithms: ['HS256'] }) as MfaChallengePayload;
  if (payload.purpose !== 'mfa' || !payload.userId) throw new Error('Invalid MFA challenge');
  return payload;
}
