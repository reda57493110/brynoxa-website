import { cloudinary, cloudinaryConfigured } from '../config/cloudinary';
import { ApiError } from '../utils/ApiError';
import { Product } from '../models/Product';
import { StoredImage, STORED_IMAGE_PATH } from '../models/StoredImage';

/** Uploads older than this that no product uses are treated as abandoned (form closed without saving). */
const ABANDONED_UPLOAD_MS = 24 * 60 * 60 * 1000;

function uploadToCloudinary(buffer: Buffer, folder = 'brynoxa'): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error || !result) {
          reject(new ApiError(500, 'Image upload failed'));
          return;
        }
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

/** Deletes the given photos unless a product still uses them. Never throws. */
export async function deleteUnusedImages(images: { url: string; publicId?: string }[]) {
  for (const { url, publicId } of images) {
    if (!publicId) continue;
    try {
      const inUse = await Product.exists({
        $or: [{ 'images.publicId': publicId }, { 'images.url': url }],
      });
      if (!inUse) await deleteImage(publicId);
    } catch (err) {
      console.error('Image cleanup failed', err);
    }
  }
}

/** Deletes stored uploads that were never attached to any product. Never throws. */
export async function deleteAbandonedUploads() {
  try {
    const cutoff = new Date(Date.now() - ABANDONED_UPLOAD_MS);
    const old = await StoredImage.find({ createdAt: { $lt: cutoff } }).select('_id').lean();
    if (!old.length) return;
    const [publicIds, urls] = await Promise.all([
      Product.distinct('images.publicId'),
      Product.distinct('images.url'),
    ]);
    const used = new Set<string>([...publicIds, ...urls].map(String));
    const abandoned = old
      .map((doc) => String(doc._id))
      .filter((id) => !used.has(`db_${id}`) && !used.has(`${STORED_IMAGE_PATH}${id}`));
    if (abandoned.length) await StoredImage.deleteMany({ _id: { $in: abandoned } });
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
