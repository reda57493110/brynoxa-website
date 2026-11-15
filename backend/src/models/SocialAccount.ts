import mongoose, { Schema, Document, Types } from 'mongoose';

export const SOCIAL_PLATFORMS = ['facebook', 'instagram', 'tiktok'] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

/**
 * Admin → Social media: a connected account. Access keys are sealed (utils/secretBox) and never
 * leave the server. Facebook and Instagram share the Facebook Page key (Instagram is the business
 * account linked to the Page).
 */
export interface ISocialAccount extends Document {
  platform: SocialPlatform;
  /** Page id / Instagram business account id / TikTok open_id */
  externalId: string;
  name: string;
  username?: string;
  picture?: string;
  link?: string;
  /** Facebook Page id (Instagram: the Page it is linked to) */
  pageId?: string;
  tokenSealed: string;
  refreshSealed?: string;
  tokenExpiresAt?: Date;
  refreshExpiresAt?: Date;
  connectedBy?: Types.ObjectId;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const socialAccountSchema = new Schema<ISocialAccount>(
  {
    platform: { type: String, enum: SOCIAL_PLATFORMS, required: true, unique: true },
    externalId: { type: String, required: true },
    name: { type: String, default: '' },
    username: String,
    picture: String,
    link: String,
    pageId: String,
    tokenSealed: { type: String, required: true },
    refreshSealed: String,
    tokenExpiresAt: Date,
    refreshExpiresAt: Date,
    connectedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastError: String,
  },
  { timestamps: true }
);

export const SocialAccount = mongoose.model<ISocialAccount>('SocialAccount', socialAccountSchema);

/** Followers of a platform on a day (one row per day, kept for the growth chart) */
export interface ISocialSnapshot extends Document {
  platform: SocialPlatform;
  day: string;
  followers: number;
  posts?: number;
}

const socialSnapshotSchema = new Schema<ISocialSnapshot>(
  {
    platform: { type: String, enum: SOCIAL_PLATFORMS, required: true },
    day: { type: String, required: true },
    followers: { type: Number, required: true },
    posts: Number,
  },
  { timestamps: true }
);
socialSnapshotSchema.index({ platform: 1, day: 1 }, { unique: true });

export const SocialSnapshot = mongoose.model<ISocialSnapshot>('SocialSnapshot', socialSnapshotSchema);
