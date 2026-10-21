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

/** ±1 step (30 s each side): enough for a phone clock that is slightly off. */
const TOTP_WINDOW = 1;

/**
 * The 30-second time step a valid 6-digit code belongs to, or null if the code is wrong.
 * Callers store the last used step so the same code cannot be used twice.
 */
export function totpStep(secret: string, code: string): number | null {
  const cleaned = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleaned)) return null;
  try {
    const totp = toTotp(secret);
    const delta = totp.validate({ token: cleaned, window: TOTP_WINDOW });
    if (delta === null) return null;
    return Math.floor(Date.now() / 1000 / totp.period) + delta;
  } catch {
    return null;
  }
}

/** Verify a 6-digit TOTP (setup confirmation). */
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  return totpStep(secret, code) !== null;
}
