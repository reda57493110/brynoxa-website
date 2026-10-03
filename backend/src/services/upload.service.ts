import { cloudinary, cloudinaryConfigured } from '../config/cloudinary';
import { ApiError } from '../utils/ApiError';
import { StoredImage, STORED_IMAGE_PATH } from '../models/StoredImage';

export async function uploadImageBuffer(
  buffer: Buffer,
  folder = 'brynoxa'
): Promise<{ url: string; publicId: string }> {
  if (!cloudinaryConfigured) {
    // Dev fallback: data URL is not ideal for production lists; use placeholder host
    const base64 = buffer.toString('base64');
    return {
      url: `data:image/jpeg;base64,${base64.slice(0, 100)}...`,
      publicId: `local_${Date.now()}`,
    };
  }

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
  return uploadImageBuffer(buffer);
}

/** Stored photos never change once uploaded, so browsers and the CDN may keep them. */
export const STORED_IMAGE_CACHE = 'public, max-age=31536000, s-maxage=31536000, immutable';

/** Returns a stored photo by id, or null when the id is invalid or unknown. */
export async function getStoredImage(id: string) {
  if (!/^[a-f0-9]{24}$/i.test(id)) return null;
  const doc = await StoredImage.findById(id).select('data contentType');
  return doc ? { data: Buffer.from(doc.data), contentType: doc.contentType } : null;
}
