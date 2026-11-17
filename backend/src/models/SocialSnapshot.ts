import mongoose, { Schema, Document } from 'mongoose';

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Admin → Social media: the followers (and posts) of a platform on a day, typed by staff with
 * "Update my numbers". One row per platform and day; feeds the cards and the growth chart.
 */
export interface ISocialSnapshot extends Document {
  platform: SocialPlatform;
  day: string;
  followers: number;
  posts?: number;
  manual?: boolean;
}

const socialSnapshotSchema = new Schema<ISocialSnapshot>(
  {
    platform: { type: String, enum: SOCIAL_PLATFORMS, required: true },
    day: { type: String, required: true },
    followers: { type: Number, required: true },
    posts: Number,
    manual: Boolean,
  },
  { timestamps: true }
);
socialSnapshotSchema.index({ platform: 1, day: 1 }, { unique: true });

export const SocialSnapshot = mongoose.model<ISocialSnapshot>('SocialSnapshot', socialSnapshotSchema);
