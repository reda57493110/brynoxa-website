import { env, isProd } from './env';

/** Same-origin Vercel deploys can use lax cookies; cross-origin APIs need none + secure. */
export function getCookieSameSite(): 'lax' | 'none' {
  if (!isProd) return 'lax';

  try {
    const clientHost = new URL(env.CLIENT_URL).hostname;
    const vercelHost = process.env.VERCEL_URL;
    if (vercelHost && (clientHost === vercelHost || clientHost === `www.${vercelHost}`)) {
      return 'lax';
    }
  } catch {
    // fall through to cross-site default
  }

  return 'none';
}
