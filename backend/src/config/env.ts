import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

function resolveClientUrl(raw?: string): string {
  const trimmed = raw?.replace(/\/$/, '');
  if (trimmed) return trimmed;
  const vercelUrl = process.env.VERCEL_URL?.replace(/\/$/, '');
  if (vercelUrl) return `https://${vercelUrl}`;
  return 'http://localhost:5173';
}

const envSchema = z.object({
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MONGODB_URI: z.string().min(1),
  CLIENT_URL: z.preprocess((value) => resolveClientUrl(typeof value === 'string' ? value : undefined), z.string().url()),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES: z.string().default('15m'),
  JWT_REFRESH_EXPIRES: z.string().default('7d'),
  MFA_ENCRYPTION_KEY: z.string().min(32).optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(6).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production') {
  const accessSecret = process.env.JWT_ACCESS_SECRET || '';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || '';
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  if (
    accessSecret.length < 32 ||
    refreshSecret.length < 32 ||
    (process.env.MFA_ENCRYPTION_KEY || '').length < 32 ||
    !process.env.ADMIN_EMAIL ||
    adminPassword.length < 12
  ) {
    console.error(
      'Production requires explicit 32+ character JWT secrets, MFA_ENCRYPTION_KEY, ADMIN_EMAIL, and a 12+ character ADMIN_PASSWORD'
    );
    process.exit(1);
  }
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';

export function isEmailConfigured(): boolean {
  const key = env.RESEND_API_KEY?.trim();
  return Boolean(
    key &&
      key !== 'PASTE_YOUR_RESEND_KEY_HERE' &&
      env.EMAIL_FROM &&
      !env.EMAIL_FROM.includes('example.com')
  );
}
