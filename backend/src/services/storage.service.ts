import mongoose from 'mongoose';
import { env } from '../config/env';
import { cloudinaryConfigured } from '../config/cloudinary';
import { StoredImage } from '../models/StoredImage';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { User } from '../models/User';

/**
 * Admin → Settings → General: how full the database is. MongoDB Atlas counts data and indexes
 * against the plan's limit (512 MB on the free M0 plan; STORAGE_LIMIT_MB for another plan).
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

export async function storageStats() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');
  const [stats, photos, products, orders, customers] = await Promise.all([
    db.stats(),
    StoredImage.aggregate<{ count: number; bytes: number }>([{ $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$size' } } }]),
    Product.estimatedDocumentCount(),
    Order.estimatedDocumentCount(),
    User.countDocuments({ role: 'customer' }),
  ]);
  return storageSummary({
    dataBytes: Number(stats.dataSize) || 0,
    indexBytes: Number(stats.indexSize) || 0,
    photoCount: photos[0]?.count ?? 0,
    photoBytes: photos[0]?.bytes ?? 0,
    limitMb: env.STORAGE_LIMIT_MB,
    cloudinary: cloudinaryConfigured,
    counts: { products, orders, customers },
  });
}
