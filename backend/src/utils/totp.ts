import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** RFC 4648 Base32 alphabet (no padding required for authenticator apps). */
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(secret: string): Uint8Array {
  const cleaned = secret.replace(/=+$/g, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

function hotp(secret: Uint8Array, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', Buffer.from(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, '0');
}

/** Generate a Base32 TOTP secret (compatible with Google Authenticator / Authy). */
export async function createTotpSecret(length = 20): Promise<string> {
  return base32Encode(randomBytes(length));
}

export async function createTotpUri(options: {
  issuer: string;
  label: string;
  secret: string;
}): Promise<string> {
  const label = encodeURIComponent(`${options.issuer}:${options.label}`);
  const issuer = encodeURIComponent(options.issuer);
  return `otpauth://totp/${label}?secret=${options.secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/** Verify a 6-digit TOTP with ±1 step (30s) window. */
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const cleaned = code.trim();
  if (!/^\d{6}$/.test(cleaned)) return false;

  const key = base32Decode(secret);
  if (!key.length) return false;

  const step = 30;
  const counter = Math.floor(Date.now() / 1000 / step);
  const tokenBuf = Buffer.from(cleaned);

  for (let drift = -1; drift <= 1; drift++) {
    const expected = Buffer.from(hotp(key, counter + drift));
    if (expected.length === tokenBuf.length && timingSafeEqual(expected, tokenBuf)) {
      return true;
    }
  }
  return false;
}
