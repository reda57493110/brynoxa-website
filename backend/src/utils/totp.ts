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

/** Verify a 6-digit TOTP with ±3 step (30s) window. */
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const cleaned = code.replace(/\D/g, '');
  if (!/^\d{6}$/.test(cleaned)) return false;

  try {
    const delta = toTotp(secret).validate({ token: cleaned, window: 3 });
    return delta !== null;
  } catch {
    return false;
  }
}
