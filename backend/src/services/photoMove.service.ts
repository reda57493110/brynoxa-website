import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { StoredImage, STORED_IMAGE_PATH } from '../models/StoredImage';
import { cloudinaryConfigured } from '../config/cloudinary';
import { ApiError } from '../utils/ApiError';
import { uploadProductImage } from './upload.service';

/**
 * Admin → Products: photos uploaded before Cloudinary was set up live in MongoDB and are served
 * full size through a server function. Once Cloudinary is configured they are moved there (light,
 * resized versions on phones), a few products / categories per call; the button calls again
 * until `remaining` is 0. A photo that fails keeps its current link, nothing is lost.
 */

type ProductImage = { url: string; publicId?: string; alt?: string; isPrimary?: boolean };
type Moved = { url: string; publicId: string };

const OWN_PHOTO = new RegExp(`^${STORED_IMAGE_PATH.replace(/\//g, '\\/')}`);

/** The MongoDB id behind one of our own photo addresses (null for any other address). */
export function storedPhotoId(url: string | undefined): string | null {
  if (!url || !url.startsWith(STORED_IMAGE_PATH)) return null;
  const id = url.slice(STORED_IMAGE_PATH.length).split(/[?#]/)[0];
  return /^[a-f0-9]{24}$/i.test(id) ? id : null;
}

async function moveOne(id: string, done: Map<string, Moved>): Promise<Moved> {
  const already = done.get(id);
  if (already) return already;
  const doc = await StoredImage.findById(id);
  if (!doc) throw new Error('Photo missing from the database');
  const moved = await uploadProductImage(doc.data, doc.contentType);
  if (!moved.url.includes('res.cloudinary.com')) throw new Error('Cloudinary is not set up');
  done.set(id, moved);
  return moved;
}

/** Deletes the old copy once no product or category uses its address any more. */
async function dropIfUnused(id: string) {
  const url = `${STORED_IMAGE_PATH}${id}`;
  const [product, category] = await Promise.all([Product.exists({ 'images.url': url }), Category.exists({ image: url })]);
  if (!product && !category) await StoredImage.deleteOne({ _id: id });
}

export async function moveStoredPhotos(opts: { dryRun?: boolean; skip?: string[]; maxItems?: number } = {}) {
  const skip = new Set(opts.skip ?? []);
  const [products, categories] = await Promise.all([
    Product.find({ 'images.url': OWN_PHOTO }).select('name images').lean<{ _id: unknown; name: string; images: ProductImage[] }[]>(),
    Category.find({ image: OWN_PHOTO }).select('name image').lean<{ _id: unknown; name: string; image?: string }[]>(),
  ]);
  const items = [
    ...products.map((p) => ({ key: String(p._id), kind: 'product' as const, name: p.name, product: p })),
    ...categories.map((c) => ({ key: `category:${c._id}`, kind: 'category' as const, name: c.name, category: c })),
  ];
  const photos =
    products.reduce((a, p) => a + p.images.filter((i) => storedPhotoId(i.url)).length, 0) + categories.length;

  if (opts.dryRun) {
    return { cloudinary: cloudinaryConfigured, remaining: items.length, photos, processed: [] as { key: string; name: string; moved: number; failed: number }[] };
  }
  if (!cloudinaryConfigured) {
    throw new ApiError(400, 'Add the Cloudinary keys in Vercel (Settings → Environment Variables) and redeploy first');
  }

  const started = Date.now();
  const done = new Map<string, Moved>();
  const processed: { key: string; name: string; moved: number; failed: number }[] = [];
  for (const item of items.filter((i) => !skip.has(i.key)).slice(0, Math.max(1, opts.maxItems ?? 3))) {
    if (Date.now() - started > 20_000) break;
    let moved = 0;
    let failed = 0;
    const movedIds: string[] = [];
    if (item.kind === 'product') {
      const images: ProductImage[] = [];
      for (const img of item.product.images) {
        const id = storedPhotoId(img.url);
        if (!id) {
          images.push(img);
          continue;
        }
        try {
          const to = await moveOne(id, done);
          images.push({ ...img, url: to.url, publicId: to.publicId });
          movedIds.push(id);
          moved++;
        } catch {
          images.push(img);
          failed++;
        }
      }
      if (moved) await Product.updateOne({ _id: item.product._id }, { $set: { images } });
    } else {
      const id = storedPhotoId(item.category.image);
      if (id) {
        try {
          const to = await moveOne(id, done);
          await Category.updateOne({ _id: item.category._id }, { $set: { image: to.url } });
          movedIds.push(id);
          moved++;
        } catch {
          failed++;
        }
      }
    }
    for (const id of movedIds) await dropIfUnused(id).catch(() => undefined);
    processed.push({ key: item.key, name: item.name, moved, failed });
  }
  const left = items.filter((i) => !skip.has(i.key)).length - processed.filter((p) => p.failed === 0).length;
  return { cloudinary: true, remaining: Math.max(0, left), processed };
}
