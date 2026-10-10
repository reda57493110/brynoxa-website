import mongoose, { Document, Schema } from 'mongoose';

export interface IShippingCityRate {
  city: string;
  rate: number;
}

/** Automatic emails the admin can switch on/off. Verification and password-reset emails are always sent. */
export const EMAIL_EVENTS = [
  'orderPlaced',
  'orderConfirmed',
  'orderShipped',
  'orderDelivered',
  'orderCancelled',
  'depositRequested',
  'depositReceived',
  'staffNewOrder',
  'securityAlerts',
] as const;
export type EmailEvent = (typeof EMAIL_EVENTS)[number];

/** Customer emails that can carry an extra message written by the admin. */
export const EMAIL_MESSAGE_EVENTS = [
  'orderPlaced',
  'orderConfirmed',
  'orderShipped',
  'orderDelivered',
  'orderCancelled',
  'depositRequested',
  'depositReceived',
] as const;
export type EmailMessageEvent = (typeof EMAIL_MESSAGE_EVENTS)[number];

const MAX_EMAIL_MESSAGE = 1000;

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
  /** On/off per automatic email; missing keys count as on. */
  emailNotifications: Partial<Record<EmailEvent, boolean>>;
  /** Optional extra paragraph added to a customer email. */
  emailMessages: Partial<Record<EmailMessageEvent, string>>;
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
    emailNotifications: {
      type: Object.fromEntries(EMAIL_EVENTS.map((key) => [key, { type: Boolean, default: true }])),
      default: () => ({}),
    },
    emailMessages: {
      type: Object.fromEntries(
        EMAIL_MESSAGE_EVENTS.map((key) => [key, { type: String, default: '', maxlength: MAX_EMAIL_MESSAGE }])
      ),
      default: () => ({}),
    },
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

/** Keeps only known email switches (booleans), merged over the current ones. */
export function sanitizeEmailNotifications(
  input: unknown,
  current: Partial<Record<EmailEvent, boolean>> = {}
): Record<EmailEvent, boolean> {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out = {} as Record<EmailEvent, boolean>;
  for (const key of EMAIL_EVENTS) {
    out[key] = typeof src[key] === 'boolean' ? (src[key] as boolean) : current[key] !== false;
  }
  return out;
}

/** Keeps only known custom messages (trimmed text, capped length), merged over the current ones. */
export function sanitizeEmailMessages(
  input: unknown,
  current: Partial<Record<EmailMessageEvent, string>> = {}
): Record<EmailMessageEvent, string> {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const out = {} as Record<EmailMessageEvent, string>;
  for (const key of EMAIL_MESSAGE_EVENTS) {
    const value = src[key] === undefined ? current[key] : src[key];
    out[key] = String(value ?? '').trim().slice(0, MAX_EMAIL_MESSAGE);
  }
  return out;
}

/** Whether an automatic email type is switched on (on unless explicitly turned off). */
export function isEmailEnabled(settings: Pick<ISettings, 'emailNotifications'>, event: EmailEvent) {
  return settings.emailNotifications?.[event] !== false;
}

export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}
