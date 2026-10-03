import mongoose, { Schema, Document } from 'mongoose';

/** Uploaded product photo kept in MongoDB when Cloudinary is not configured. */
export interface IStoredImage extends Document {
  data: Buffer;
  contentType: string;
  size: number;
  createdAt: Date;
}

const storedImageSchema = new Schema<IStoredImage>(
  {
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const StoredImage = mongoose.model<IStoredImage>('StoredImage', storedImageSchema);

/** Public path an uploaded image is served from (relative, so it works on any domain). */
export const STORED_IMAGE_PATH = '/api/v1/images/';
