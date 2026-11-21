import { createPublicKey, randomBytes, type KeyObject } from 'crypto';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError';

/**
 * "Continue with Google": Google's button gives the shop a signed ID token (a JWT). We check it
 * ourselves with Google's public keys — signature, issuer, our client ID as audience, not expired,
 * email verified by Google — so nobody can sign in as someone else by sending a made-up token.
 *
 * The OAuth client ID of Google Cloud project "brynoxa" (not secret: Google shows it on the page,
 * and it only works from the addresses listed in Google Cloud → Clients → Authorized JavaScript
 * origins). A Vercel variable replaces it (GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_ID); "off" turns
 * Google sign-in off. Same ID as frontend/src/components/auth/GoogleSignIn.tsx.
 */
export const BRYNOXA_GOOGLE_CLIENT_ID = '450854734072-oqcrbd4snjmicsf1q1v2cdoo334o10sk.apps.googleusercontent.com';
export function googleClientId() {
  const id = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || BRYNOXA_GOOGLE_CLIENT_ID).trim();
  return id === 'off' ? '' : id;
}

const CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'] as [string, string];

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string; use?: string };
let certCache: { keys: Map<string, KeyObject>; until: number } | null = null;

/** Google's public keys, kept as long as Google says (Cache-Control max-age), 1 h by default */
async function googleKeys(force = false) {
  if (!force && certCache && certCache.until > Date.now()) return certCache.keys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new ApiError(503, 'Google sign-in is temporarily unavailable. Please try again.');
  const body = (await res.json()) as { keys?: Jwk[] };
  const keys = new Map<string, KeyObject>();
  for (const k of body.keys ?? []) {
    if (k.kty === 'RSA' && k.kid) keys.set(k.kid, createPublicKey({ key: k as never, format: 'jwk' }));
  }
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get('cache-control') || '')?.[1] || 3600);
  certCache = { keys, until: Date.now() + Math.min(maxAge, 6 * 3600) * 1000 };
  return keys;
}

export type GoogleProfile = { email: string; name: string; sub: string };

/** The checked Google account (email verified by Google), or an error the customer can read */
export async function verifyGoogleCredential(credential: string): Promise<GoogleProfile> {
  const clientId = googleClientId();
  if (!clientId) throw new ApiError(503, 'Google sign-in is not set up yet.');
  const decoded = jwt.decode(credential, { complete: true });
  const kid = decoded && typeof decoded === 'object' ? decoded.header.kid : undefined;
  if (!kid || decoded?.header.alg !== 'RS256') throw new ApiError(401, 'Google sign-in failed. Please try again.');
  let key = (await googleKeys()).get(kid);
  // Google changes its keys from time to time: fetch them again once
  if (!key) key = (await googleKeys(true)).get(kid);
  if (!key) throw new ApiError(401, 'Google sign-in failed. Please try again.');
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(credential, key, { algorithms: ['RS256'], audience: clientId, issuer: ISSUERS }) as jwt.JwtPayload;
  } catch {
    throw new ApiError(401, 'Google sign-in failed. Please try again.');
  }
  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  if (!email || (payload.email_verified !== true && payload.email_verified !== 'true')) {
    throw new ApiError(401, 'This Google account has no verified email.');
  }
  const name = (typeof payload.name === 'string' && payload.name.trim()) || email.split('@')[0];
  return { email, name: name.slice(0, 80), sub: String(payload.sub || '') };
}

/** A long random password for accounts made with Google (they can set their own later with "Forgot password") */
export function randomAccountPassword() {
  return `${randomBytes(24).toString('base64url')}Aa1!`;
}
