import mongoose from 'mongoose';
import { cloudinary, cloudinaryConfigured } from '../config/cloudinary';
import { ApiError } from '../utils/ApiError';
import { Product } from '../models/Product';
import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { StoredImage, STORED_IMAGE_PATH } from '../models/StoredImage';

/** Uploads older than this that nothing uses are treated as abandoned (form closed without saving). */
const ABANDONED_UPLOAD_MS = 24 * 60 * 60 * 1000;

/** Cloudinary uploads not yet known to be used (see deleteAbandonedUploads). */
const pendingUploads = () =>
  mongoose.connection.db?.collection<{ _id: string; url: string; createdAt: Date }>('pending_uploads');

function uploadToCloudinary(buffer: Buffer, folder = 'brynoxa'): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          reject(new ApiError(500, 'Image upload failed'));
          return;
        }
        // Noted until it is used: closing the form without saving would otherwise leave it in
        // Cloudinary forever
        void pendingUploads()
          ?.insertOne({ _id: result.public_id, url: result.secure_url, createdAt: new Date() })
          .catch(() => undefined);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

export async function deleteImage(publicId?: string) {
  if (publicId?.startsWith('db_')) {
    await StoredImage.deleteOne({ _id: publicId.slice(3) });
    return;
  }
  if (!publicId || !cloudinaryConfigured) return;
  await cloudinary.uploader.destroy(publicId);
}

/** Uploads to Cloudinary when configured, otherwise stores the photo in MongoDB. */
export async function uploadProductImage(buffer: Buffer, mimetype: string) {
  if (!cloudinaryConfigured) {
    const doc = await StoredImage.create({ data: buffer, contentType: mimetype, size: buffer.length });
    const id = String(doc._id);
    return { url: `${STORED_IMAGE_PATH}${id}`, publicId: `db_${id}` };
  }
  return uploadToCloudinary(buffer);
}

/** A product, category or brand still shows this photo. */
export async function imageInUse(url: string, publicId?: string) {
  const [product, category, brand] = await Promise.all([
    Product.exists({ $or: [{ 'images.url': url }, ...(publicId ? [{ 'images.publicId': publicId }] : [])] }),
    Category.exists({ image: url }),
    Brand.exists({ logo: url }),
  ]);
  return Boolean(product || category || brand);
}

/**
 * The id to delete a photo by, from its address: Cloudinary ".../image/upload/v123/brynoxa/abc.jpg"
 * → "brynoxa/abc", a photo stored in the database → "db_<id>". Any other address: null (never
 * deleted, e.g. a photo hosted elsewhere).
 */
export function publicIdFromUrl(url?: string | null) {
  if (!url) return null;
  if (url.startsWith(STORED_IMAGE_PATH)) return `db_${url.slice(STORED_IMAGE_PATH.length)}`;
  const match = url.match(/^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/(?:[^/]+\/)*?(brynoxa\/[^.?#]+)\.[a-z0-9]+(?:[?#].*)?$/i);
  return match ? match[1] : null;
}

/** Deletes the given photos unless something still uses them. Never throws. */
export async function deleteUnusedImages(images: { url: string; publicId?: string }[]) {
  for (const { url, publicId } of images) {
    const id = publicId || publicIdFromUrl(url);
    if (!id) continue;
    try {
      if (!(await imageInUse(url, id))) await deleteImage(id);
    } catch (err) {
      console.error('Image cleanup failed', err);
    }
  }
}

/** A category photo or brand logo that was replaced or removed: deleted when nothing else uses it. */
export async function deleteReplacedImage(previous?: string | null, current?: string | null) {
  if (previous && previous !== current) await deleteUnusedImages([{ url: previous }]);
}

/**
 * Deletes uploads that were never attached to a product, category or brand (older than a day):
 * photos stored in the database, and Cloudinary uploads noted in `pending_uploads`. Never throws.
 */
export async function deleteAbandonedUploads() {
  try {
    const cutoff = new Date(Date.now() - ABANDONED_UPLOAD_MS);
    const [old, pending] = await Promise.all([
      StoredImage.find({ createdAt: { $lt: cutoff } }).select('_id').lean(),
      pendingUploads()?.find({ createdAt: { $lt: cutoff } }).limit(200).toArray() ?? Promise.resolve([]),
    ]);
    if (!old.length && !pending.length) return;
    // Every photo address in use: products, categories, brands
    const [publicIds, urls, categoryImages, brandLogos] = await Promise.all([
      Product.distinct('images.publicId'),
      Product.distinct('images.url'),
      Category.distinct('image'),
      Brand.distinct('logo'),
    ]);
    const used = new Set<string>([...publicIds, ...urls, ...categoryImages, ...brandLogos].filter(Boolean).map(String));
    const abandoned = old
      .map((doc) => String(doc._id))
      .filter((id) => !used.has(`db_${id}`) && !used.has(`${STORED_IMAGE_PATH}${id}`));
    if (abandoned.length) await StoredImage.deleteMany({ _id: { $in: abandoned } });
    // Cloudinary uploads never saved on anything are deleted there too; the note goes either way
    for (const upload of pending) {
      if (!used.has(upload._id) && !used.has(upload.url)) await deleteImage(upload._id).catch(() => undefined);
    }
    if (pending.length) await pendingUploads()?.deleteMany({ _id: { $in: pending.map((upload) => upload._id) } });
  } catch (err) {
    console.error('Abandoned upload cleanup failed', err);
  }
}


/** Stored photos never change once uploaded, so browsers and the CDN may keep them. */
export const STORED_IMAGE_CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable';

/** Returns a stored photo by id, or null when the id is invalid or unknown. */
export async function getStoredImage(id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const doc = await StoredImage.findById(id).select('data contentType');
  return doc ? { data: Buffer.from(doc.data), contentType: doc.contentType } : null;
}
