import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPushSubscription extends Document {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  locale: 'en' | 'fr' | 'ar';
  user?: Types.ObjectId;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    locale: { type: String, enum: ['en', 'fr', 'ar'], default: 'fr' },
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true }
);

export const PushSubscription = mongoose.model<IPushSubscription>(
  'PushSubscription',
  pushSubscriptionSchema
);

export interface IPushCampaign extends Document {
  title: string;
  body: string;
  url?: string;
  image?: string;
  sentBy?: Types.ObjectId;
  sentByName?: string;
  targeted: number;
  delivered: number;
  failed: number;
  removed: number;
  createdAt: Date;
}

const pushCampaignSchema = new Schema<IPushCampaign>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    url: String,
    image: String,
    sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sentByName: String,
    targeted: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    removed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pushCampaignSchema.index({ createdAt: -1 });

export const PushCampaign = mongoose.model<IPushCampaign>('PushCampaign', pushCampaignSchema);
