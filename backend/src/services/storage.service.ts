import mongoose from 'mongoose';
import { env } from '../config/env';
import { cloudinary, cloudinaryConfigured } from '../config/cloudinary';
import { StoredImage } from '../models/StoredImage';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { User } from '../models/User';
import { getSettings, Settings } from '../models/Settings';

/**
 * Admin → Settings → General: how full the database is, and Cloudinary's usage when connected.
 * MongoDB Atlas counts data and indexes against the plan's size: the owner sets it in the Storage
 * box (Settings.storageLimitMb), else STORAGE_LIMIT_MB, else 512 MB (free M0 plan).
 */

export type StorageLevel = 'ok' | 'watch' | 'high';

export type StorageRaw = {
  dataBytes: number;
  indexBytes: number;
  photoCount: number;
  photoBytes: number;
  limitMb: number;
  cloudinary: boolean;
  counts: { products: number; orders: number; customers: number };
};

export const DEFAULT_LIMIT_MB = 512;

/** The plan size used: the one set in the Storage box, else the server setting, else the free plan. */
export function planLimitMb(savedMb: number | undefined, envMb: number | undefined) {
  if (savedMb && savedMb > 0) return { limitMb: savedMb, limitSource: 'set' as const };
  if (envMb && envMb > 0 && envMb !== DEFAULT_LIMIT_MB) return { limitMb: envMb, limitSource: 'server' as const };
  return { limitMb: DEFAULT_LIMIT_MB, limitSource: 'default' as const };
}

/** The figures and advice shown in the box (kept separate from the database calls so it can be tested). */
export function storageSummary(raw: StorageRaw) {
  const usedBytes = Math.max(0, raw.dataBytes) + Math.max(0, raw.indexBytes);
  const limitBytes = Math.max(1, raw.limitMb) * 1024 * 1024;
  const percent = Math.round((usedBytes / limitBytes) * 1000) / 10;
  const level: StorageLevel = percent >= 85 ? 'high' : percent >= 60 ? 'watch' : 'ok';
  const photoShare = usedBytes > 0 ? Math.round((raw.photoBytes / usedBytes) * 100) : 0;
  // Moving photos frees space only while some are still in the database
  const suggestCloudinary = raw.photoCount > 0 && (level !== 'ok' || photoShare >= 50);
  return {
    usedBytes,
    limitBytes,
    percent,
    level,
    photos: { count: raw.photoCount, bytes: raw.photoBytes, share: photoShare },
    counts: raw.counts,
    cloudinary: raw.cloudinary,
    suggestCloudinary,
  };
}

/** What we show from Cloudinary's usage report (its plan, storage, monthly credits). */
export function cloudinaryUsageSummary(raw: Record<string, unknown> | null | undefined) {
  if (!raw || typeof raw !== 'object') return null;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const part = (k: string) => (raw[k] && typeof raw[k] === 'object' ? (raw[k] as Record<string, unknown>) : {});
  const credits = part('credits');
  const limit = num(credits.limit);
  const used = num(credits.usage);
  const percent = num(credits.used_percent) ?? (limit && used !== null ? Math.round((used / limit) * 1000) / 10 : null);
  return {
    plan: typeof raw.plan === 'string' && raw.plan.trim() ? raw.plan.trim() : null,
    storageBytes: num(part('storage').usage),
    bandwidthBytes: num(part('bandwidth').usage),
    creditsUsed: used,
    creditsLimit: limit,
    creditsPercent: percent,
    level: (percent ?? 0) >= 85 ? ('high' as const) : (percent ?? 0) >= 60 ? ('watch' as const) : ('ok' as const),
  };
}

// Cloudinary's report changes slowly: read it at most every 10 minutes per server instance
const CLOUDINARY_CACHE_MS = 10 * 60_000;
let cloudinaryCache: { at: number; data: ReturnType<typeof cloudinaryUsageSummary> } | null = null;

async function cloudinaryUsage() {
  if (!cloudinaryConfigured) return null;
  if (cloudinaryCache && Date.now() - cloudinaryCache.at < CLOUDINARY_CACHE_MS) return cloudinaryCache.data;
  try {
    // Never let a slow answer from Cloudinary hold the page up
    const raw = await Promise.race([
      cloudinary.api.usage() as Promise<Record<string, unknown>>,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    const data = cloudinaryUsageSummary(raw);
    if (data) cloudinaryCache = { at: Date.now(), data };
    return data;
  } catch {
    return null;
  }
}

export async function storageStats() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');
  const [stats, photos, products, orders, customers, settings, cloud] = await Promise.all([
    db.stats(),
    StoredImage.aggregate<{ count: number; bytes: number }>([{ $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$size' } } }]),
    Product.estimatedDocumentCount(),
    Order.estimatedDocumentCount(),
    User.countDocuments({ role: 'customer' }),
    getSettings(),
    cloudinaryUsage(),
  ]);
  const plan = planLimitMb(settings.storageLimitMb, env.STORAGE_LIMIT_MB);
  return {
    ...storageSummary({
      dataBytes: Number(stats.dataSize) || 0,
      indexBytes: Number(stats.indexSize) || 0,
      photoCount: photos[0]?.count ?? 0,
      photoBytes: photos[0]?.bytes ?? 0,
      limitMb: plan.limitMb,
      cloudinary: cloudinaryConfigured,
      counts: { products, orders, customers },
    }),
    limitMb: plan.limitMb,
    limitSource: plan.limitSource,
    cloudinaryUsage: cloud,
    checkedAt: new Date().toISOString(),
  };
}

/** Saves the MongoDB plan size chosen in the Storage box (0 = back to the default). */
export async function setStorageLimit(limitMb: number) {
  await Settings.findOneAndUpdate({}, { $set: { storageLimitMb: limitMb } }, { upsert: true });
  return storageStats();
}
