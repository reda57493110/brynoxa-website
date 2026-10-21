import { Product } from '../models/Product';
import { fetchRemoteImage } from '../utils/remoteImage';
import { uploadProductImage } from './upload.service';

/**
 * Product photos linked from other shops (pasted image addresses) load slowly and disappear when
 * that shop changes its site. They are copied into our own image storage (Cloudinary, or MongoDB
 * when Cloudinary is not set up) when a product is saved, and once for the existing catalogue.
 * Kept as links: our own storage, Cloudinary, and Unsplash (a fast photo CDN the shop resizes).
 */

type ProductImage = { url: string; publicId?: string; alt?: string; isPrimary?: boolean };

const KEEP_HOSTS = [/(^|\.)res\.cloudinary\.com$/i, /(^|\.)images\.unsplash\.com$/i];

export function isOutsidePhoto(url: string | undefined): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false; // our own /api/v1/images/… paths
  try {
    const u = new URL(url);
    if (u.pathname.startsWith('/api/v1/images/')) return false;
    return !KEEP_HOSTS.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

/**
 * Copies the outside photos of one product. A photo that cannot be downloaded keeps its link
 * (nothing is lost) and is reported in `failed`. Stops starting new downloads after `budgetMs`.
 */
export async function copyOutsidePhotos(images: ProductImage[] | undefined, budgetMs = 25_000) {
  const started = Date.now();
  const failed: { url: string; reason: string }[] = [];
  let copied = 0;
  if (!Array.isArray(images)) return { images, copied, failed };
  const done = new Map<string, { url: string; publicId: string }>();
  const out: ProductImage[] = [];
  for (const img of images) {
    if (!img || !isOutsidePhoto(img.url) || Date.now() - started > budgetMs) {
      out.push(img);
      continue;
    }
    try {
      let stored = done.get(img.url);
      if (!stored) {
        const { buffer, mimetype } = await fetchRemoteImage(img.url);
        stored = await uploadProductImage(buffer, mimetype);
        done.set(img.url, stored);
        copied++;
      }
      out.push({ ...img, url: stored.url, publicId: stored.publicId });
    } catch (err) {
      failed.push({ url: img.url, reason: err instanceof Error ? err.message : 'Could not download the photo' });
      out.push(img);
    }
  }
  return { images: out, copied, failed };
}

/** Products that still have at least one outside photo. */
async function productsWithOutsidePhotos() {
  const docs = await Product.find({ 'images.url': { $regex: /^https?:\/\//i } })
    .select('name images')
    .lean<{ _id: unknown; name: string; images: ProductImage[] }[]>();
  return docs.filter((p) => p.images.some((i) => isOutsidePhoto(i.url)));
}

/**
 * Admin → Products: copies the outside photos of the existing catalogue, a few products per call
 * (the button calls again until `remaining` is 0). Products whose photos all failed are skipped
 * via `skip` so the loop always ends.
 */
export async function copyCatalogOutsidePhotos(opts: { dryRun?: boolean; skip?: string[]; maxProducts?: number } = {}) {
  const skip = new Set(opts.skip ?? []);
  const pending = (await productsWithOutsidePhotos()).filter((p) => !skip.has(String(p._id)));
  if (opts.dryRun) {
    return {
      remaining: pending.length,
      photos: pending.reduce((a, p) => a + p.images.filter((i) => isOutsidePhoto(i.url)).length, 0),
      processed: [] as { productId: string; name: string; copied: number; failed: number }[],
    };
  }
  const started = Date.now();
  const processed: { productId: string; name: string; copied: number; failed: number }[] = [];
  for (const p of pending.slice(0, Math.max(1, opts.maxProducts ?? 3))) {
    if (Date.now() - started > 20_000) break;
    const r = await copyOutsidePhotos(p.images, 20_000 - (Date.now() - started));
    if (r.copied) await Product.updateOne({ _id: p._id }, { $set: { images: r.images } });
    processed.push({ productId: String(p._id), name: p.name, copied: r.copied, failed: r.failed.length });
  }
  const left = pending.length - processed.filter((x) => x.failed === 0).length;
  return { remaining: Math.max(0, left), processed };
}
