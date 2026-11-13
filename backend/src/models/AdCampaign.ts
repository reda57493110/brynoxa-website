import mongoose, { Schema, Document, Types } from 'mongoose';
import { AD_KINDS, AD_PLATFORMS, type AdKind, type AdPlatform } from '../utils/adTracking';

/**
 * Admin → Ads & social media: one ad or post. Money spent on it is saved as Expense rows
 * (category 'ads', `campaign` = this id), so it also counts in Admin → Profit. Orders are linked by
 * `code` = utm_campaign of its tracking link (Order.marketing.campaign).
 */
export interface IAdCampaign extends Document {
  name: string;
  /** utm_campaign in the tracking link; unique, never changes once orders may use it */
  code: string;
  platform: AdPlatform;
  kind: AdKind;
  /** Page the tracking link opens, e.g. "/" or "/products/some-laptop" */
  landingPath: string;
  startDate?: Date;
  endDate?: Date;
  /** Planned budget (DH), for comparison with what was really spent */
  budget?: number;
  notes?: string;
  isActive: boolean;
  by?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const adCampaignSchema = new Schema<IAdCampaign>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 64 },
    platform: { type: String, enum: AD_PLATFORMS, required: true },
    kind: { type: String, enum: AD_KINDS, default: 'paid' },
    landingPath: { type: String, default: '/', maxlength: 300 },
    startDate: Date,
    endDate: Date,
    budget: { type: Number, min: 0 },
    notes: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

adCampaignSchema.index({ createdAt: -1 });

export const AdCampaign = mongoose.model<IAdCampaign>('AdCampaign', adCampaignSchema);
