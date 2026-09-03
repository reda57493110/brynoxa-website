import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  storeName: string;
  currency: string;
  shippingFlatRate: number;
  freeShippingMin: number;
  taxRate: number;
  supportEmail: string;
  codEnabled: boolean;
  catalogVersion?: number;
}

const settingsSchema = new Schema<ISettings>(
  {
    storeName: { type: String, default: 'Brynoxa' },
    currency: { type: String, default: 'MAD' },
    shippingFlatRate: { type: Number, default: 0 },
    freeShippingMin: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    supportEmail: { type: String, default: 'support@brynoxa.com' },
    codEnabled: { type: Boolean, default: true },
    catalogVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>('Settings', settingsSchema);

export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}
