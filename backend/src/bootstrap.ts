import { migrateRefreshTokens } from './services/auth.service';
import { ensureAdmin } from './seed/seed';

declare global {
  // eslint-disable-next-line no-var
  var __brynoxaBootstrapped: boolean | undefined;
}

export async function runBootstrap(): Promise<void> {
  if (global.__brynoxaBootstrapped) return;

  if (!process.env.VERCEL) {
    await migrateRefreshTokens();
  }
  await ensureAdmin();

  global.__brynoxaBootstrapped = true;
}
