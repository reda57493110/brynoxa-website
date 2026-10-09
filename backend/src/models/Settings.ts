import mongoose, { Document, Schema } from 'mongoose';

export interface IShippingCityRate {
  city: string;
  rate: number;
}

export const HERO_PAGES = ['shop', 'services', 'contact'] as const;
export type HeroPage = (typeof HERO_PAGES)[number];

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
  /** Shown to customers whose order needs a deposit: how to pay it (bank RIB, transfer agency…). */
  depositInstructions: string;
  /** Email ADMIN_EMAIL when a staff account signs into admin. */
  notifyStaffLoginEmail: boolean;
  /** Product id featured in each store page header; empty shows the default photo. */
  pageHeroProducts: Record<HeroPage, string>;
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
    supportEmail: { type: String, default: 'brynoxa.shop@gmail.com' },
    codEnabled: { type: Boolean, default: true },
    depositInstructions: { type: String, default: '', maxlength: 2000 },
    notifyStaffLoginEmail: { type: Boolean, default: true },
    pageHeroProducts: {
      shop: { type: String, default: '' },
      services: { type: String, default: '' },
      contact: { type: String, default: '' },
    },
  },
  { timestamps: true }
);

export const Settings = mongoose.model<ISettings>('Settings', settingsSchema);

const OBJECT_ID = /^[a-f0-9]{24}$/i;
/** Stored instead of a product id when the page should show its photo, not a product. */
export const HERO_NONE = 'none';

/** Keeps only known pages with a valid product id, HERO_NONE, or '' (automatic). */
export function sanitizePageHeroProducts(
  input: unknown,
  current: Partial<Record<HeroPage, string>> = {}
): Record<HeroPage, string> {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out = {} as Record<HeroPage, string>;
  for (const page of HERO_PAGES) {
    const value = src[page];
    if (value === undefined) {
      out[page] = current[page] || '';
    } else {
      const id = String(value ?? '').trim();
      out[page] = OBJECT_ID.test(id) || id === HERO_NONE ? id : '';
    }
  }
  return out;
}

export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}
