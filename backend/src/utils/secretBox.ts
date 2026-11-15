import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

/**
 * Encrypts secrets kept in the database (social media access keys): AES-256-GCM with a key derived
 * from MFA_ENCRYPTION_KEY (or the refresh secret), separate from the one used for 2-step codes.
 */
function key(purpose: string) {
  return createHash('sha256').update(`${env.MFA_ENCRYPTION_KEY || env.JWT_REFRESH_SECRET}:${purpose}`).digest();
}

export function seal(value: string, purpose = 'social') {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(purpose), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((p) => p.toString('base64')).join('.');
}

export function unseal(value: string, purpose = 'social') {
  const [iv, tag, data] = String(value || '').split('.');
  if (!iv || !tag || !data) throw new Error('Sealed value is damaged');
  const decipher = createDecipheriv('aes-256-gcm', key(purpose), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

/** A short signed value (e.g. the "state" of a Connect button), valid `ttlMs` */
export function signState(payload: Record<string, unknown>, ttlMs = 10 * 60 * 1000) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs, n: randomBytes(8).toString('hex') })).toString('base64url');
  const mac = createHmac('sha256', key('state')).update(body).digest('base64url');
  return `${body}.${mac}`;
}

/** The payload of a signed value, or null when forged / expired */
export function readState<T extends Record<string, unknown>>(state: unknown): T | null {
  const [body, mac] = String(state ?? '').split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', key('state')).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as T & { exp?: number };
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}
