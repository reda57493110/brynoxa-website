type Otplib = typeof import('otplib');

let otplibPromise: Promise<Otplib> | null = null;

async function getOtplib(): Promise<Otplib> {
  if (!otplibPromise) {
    otplibPromise = import('otplib');
  }
  return otplibPromise;
}

export async function createTotpSecret(length = 20): Promise<string> {
  const { generateSecret } = await getOtplib();
  return generateSecret({ length });
}

export async function createTotpUri(options: {
  issuer: string;
  label: string;
  secret: string;
}): Promise<string> {
  const { generateURI } = await getOtplib();
  return generateURI(options);
}

export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code.trim())) return false;
  const { verify } = await getOtplib();
  const result = await verify({ secret, token: code.trim(), epochTolerance: 1 });
  return result.valid;
}
