import mongoose, { Document, Schema } from 'mongoose';

export interface IShippingCityRate {
  city: string;
  rate: number;
}

export interface ISettings extends Document {
  storeName: string;
  currency: string;
  shippingFlatRate: number;
  freeShippingMin: number;
  /** Per-city overrides; cities not listed use shippingFlatRate. */
  shippingByCity: IShippingCityRate[];
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
    shippingByCity: {
      type: [
        {
          city: { type: String, required: true, trim: true },
          rate: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    taxRate: { type: Number, default: 0 },
    supportEmail: { type: String, default: 'brynoxa.com@gmail.com' },
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
