import * as OTPAuth from 'otpauth';

function toTotp(secret: string, options?: { issuer?: string; label?: string }) {
  return new OTPAuth.TOTP({
    issuer: options?.issuer || 'Brynoxa',
    label: options?.label || 'account',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

/** Generate a Base32 TOTP secret (compatible with Google Authenticator / Authy). */
export async function createTotpSecret(length = 20): Promise<string> {
  return new OTPAuth.Secret({ size: length }).base32;
}

export async function createTotpUri(options: {
  issuer: string;
  label: string;
  secret: string;
}): Promise<string> {
  return toTotp(options.secret, options).toString();
}

/**
 * ±2 steps (about a minute each side): a phone clock that is a bit off, or a code that changed
 * while it was being typed, still works. Each code can only be used once (see consumeTotp).
 */
const TOTP_WINDOW = 2;

/** Largest phone-clock difference learned at setup: 10 minutes (20 steps of 30 s). */
export const MAX_CLOCK_SKEW_STEPS = 20;

/** The current 30-second step on the server clock. */
export function currentTotpStep(now = Date.now()) {
  return Math.floor(now / 1000 / 30);
}

/**
 * The 30-second time step a valid 6-digit code belongs to, or null if the code is wrong.
 * `skewSteps`: how far this person's phone clock is known to be off (learned at setup, kept up
 * to date at each sign-in), so a phone a few minutes slow still works; the window stays ±2 steps
 * around it. Callers store the last used step so the same code cannot be used twice.
 */
export function totpStep(secret: string, code: string, skewSteps = 0): number | null {
  const cleaned = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleaned)) return null;
  try {
    const totp = toTotp(secret);
    const skew = Math.max(-MAX_CLOCK_SKEW_STEPS, Math.min(MAX_CLOCK_SKEW_STEPS, Math.round(skewSteps) || 0));
    const now = Date.now();
    const delta = totp.validate({ token: cleaned, window: TOTP_WINDOW, timestamp: now + skew * totp.period * 1000 });
    if (delta === null) return null;
    return currentTotpStep(now) + skew + delta;
  } catch {
    return null;
  }
}

/**
 * Diagnosis only (never used to accept a code): how many seconds off the phone's clock seems,
 * if the code belongs to this secret within ±12 hours; null if it does not belong to it at all.
 */
export function totpClockOffsetSeconds(secret: string, code: string): number | null {
  const cleaned = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleaned)) return null;
  try {
    const totp = toTotp(secret);
    const delta = totp.validate({ token: cleaned, window: 1440 });
    return delta === null ? null : delta * totp.period;
  } catch {
    return null;
  }
}

/** Verify a 6-digit TOTP (setup confirmation). */
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  return totpStep(secret, code) !== null;
}
