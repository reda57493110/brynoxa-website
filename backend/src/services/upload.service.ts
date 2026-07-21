import { cloudinary, cloudinaryConfigured } from '../config/cloudinary';
import { ApiError } from '../utils/ApiError';

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
  if (!publicId || !cloudinaryConfigured) return;
  await cloudinary.uploader.destroy(publicId);
}

/** Local/dev: store as base64 data URL when Cloudinary is not configured */
export async function uploadProductImage(buffer: Buffer, mimetype: string) {
  if (!cloudinaryConfigured) {
    const b64 = buffer.toString('base64');
    return {
      url: `data:${mimetype};base64,${b64}`,
      publicId: `local_${Date.now()}`,
    };
  }
  return uploadImageBuffer(buffer);
}
