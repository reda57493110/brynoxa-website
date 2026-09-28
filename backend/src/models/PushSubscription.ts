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

pushSubscriptionSchema.index({ user: 1 });

export type PushLocale = 'en' | 'fr' | 'ar';

export interface IPushCampaign extends Document {
  title: string;
  body: string;
  translations?: Partial<Record<PushLocale, { title: string; body: string }>>;
  url?: string;
  image?: string;
  sentBy?: Types.ObjectId;
  sentByName?: string;
  targeted: number;
  delivered: number;
  failed: number;
  removed: number;
  clicks: number;
  createdAt: Date;
}

const translationSchema = new Schema(
  { title: String, body: String },
  { _id: false }
);

const pushCampaignSchema = new Schema<IPushCampaign>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    translations: {
      en: translationSchema,
      fr: translationSchema,
      ar: translationSchema,
    },
    url: String,
    image: String,
    sentBy: { type: Schema.Types.ObjectId, ref: 'User' },
    sentByName: String,
    targeted: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    removed: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

pushCampaignSchema.index({ createdAt: -1 });

export const PushCampaign = mongoose.model<IPushCampaign>('PushCampaign', pushCampaignSchema);
