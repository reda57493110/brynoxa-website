import { env } from './config/env';
import { migrateCurrencyToMad } from './config/migrateCurrency';
import { migrateRefreshTokens } from './services/auth.service';
import { removeRetiredCategories, ensureAdmin, runSeed, syncCatalogIfNeeded } from './seed/seed';

declare global {
  // eslint-disable-next-line no-var
  var __brynoxaBootstrapped: boolean | undefined;
}

export async function runBootstrap(): Promise<void> {
  if (global.__brynoxaBootstrapped) return;

  if (process.env.VERCEL) {
    await ensureAdmin();
    await syncCatalogIfNeeded();
    global.__brynoxaBootstrapped = true;
    return;
  }

  await migrateRefreshTokens();
  await migrateCurrencyToMad();
  await removeRetiredCategories();
  await ensureAdmin();

  if (env.MONGODB_URI === 'memory' || process.env.USE_MEMORY_DB === 'true') {
    await runSeed(false);
  } else {
    await syncCatalogIfNeeded();
  }

  global.__brynoxaBootstrapped = true;
}
