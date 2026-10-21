import { env } from './config/env';
import { User } from './models/User';
import { migrateRefreshTokens } from './services/auth.service';
import { isBlockedPassword } from './utils/blockedPasswords';

declare global {
  // eslint-disable-next-line no-var
  var __brynoxaBootstrapped: boolean | undefined;
}

/** Creates the owner account from ADMIN_EMAIL / ADMIN_PASSWORD only when no admin exists yet. */
async function ensureAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.warn('ADMIN_EMAIL and ADMIN_PASSWORD are not configured; skipping admin bootstrap');
    return;
  }
  if (await User.exists({ role: 'admin' })) return;
  if (isBlockedPassword(env.ADMIN_PASSWORD)) {
    console.warn('ADMIN_PASSWORD is a published or common password; admin not created. Set a new one.');
    return;
  }

  await User.create({
    name: 'Brynoxa Admin',
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    role: 'admin',
  });
  console.log(`Admin created: ${env.ADMIN_EMAIL}`);
}

export async function runBootstrap(): Promise<void> {
  if (global.__brynoxaBootstrapped) return;

  if (!process.env.VERCEL) {
    await migrateRefreshTokens();
  }
  await ensureAdmin();

  global.__brynoxaBootstrapped = true;
}
