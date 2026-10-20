import mongoose, { Document, Schema } from 'mongoose';
import type { WholesaleTier } from '../utils/wholesale';

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

/** Thresholds behind the built-in customer segments, plus admin-saved custom segments. */
export interface ICustomerSegmentSettings {
  newDays: number;
  inactiveDays: number;
  highSpendMin: number;
  highProfitMin: number;
  saved: { id: string; name: string; filters: Record<string, string | number> }[];
}

export const DEFAULT_SEGMENT_SETTINGS: ICustomerSegmentSettings = {
  newDays: 30,
  inactiveDays: 90,
  highSpendMin: 20000,
  highProfitMin: 5000,
  saved: [],
};

export const HERO_PAGES = ['home', 'shop', 'services', 'contact'] as const;
export type HeroPage = (typeof HERO_PAGES)[number];

/** Ways customers can pay a deposit (shown on their order). */
export const DEPOSIT_METHOD_TYPES = ['bank', 'cashplus', 'wafacash', 'barid', 'other'] as const;
export type DepositMethodType = (typeof DEPOSIT_METHOD_TYPES)[number];
export interface DepositMethod {
  id: string;
  type: DepositMethodType;
  /** Shown name, e.g. "CIH Bank" or "Cash Plus" */
  name: string;
  /** Who receives the money */
  holder: string;
  /** RIB, account or phone number to send to */
  account: string;
  note: string;
  /** Customer steps, one per line, with {customer} {amount} {receiver} {account} {method} {order}; empty = default steps */
  steps: string;
  /** Shown to customers asked for a deposit; off = kept for later */
  visible: boolean;
}
export const MAX_DEPOSIT_METHODS = 8;

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
  depositMethods: DepositMethod[];
  /** On/off per automatic email; missing keys count as on. */
  emailNotifications: Partial<Record<EmailEvent, boolean>>;
  /** Optional extra paragraph added to a customer email. */
  emailMessages: Partial<Record<EmailMessageEvent, string>>;
  wholesaleTiers: WholesaleTier[];
  /** Extra non-sellable holding statuses (e.g. "Display unit", "On loan"). */
  inventoryStatuses: { id: string; name: string }[];
  /** Storage locations to choose from (warehouse, shop floor…). */
  inventoryLocations: string[];
  /** New supplier deliveries go to "Awaiting inspection" unless results are entered on receipt. */
  requireInspection: boolean;
  customerSegments: ICustomerSegmentSettings;
  /** Email ADMIN_EMAIL when a staff account signs into admin. */
  notifyStaffLoginEmail: boolean;
  /** Product id featured in each store page header; empty shows the default photo. */
  pageHeroProducts: Record<HeroPage, string>;
  /** Products shown as deals at the top of the home page (max 4, in order). Empty: automatic. */
  homeDeals: string[];
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
    depositMethods: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            type: { type: String, enum: DEPOSIT_METHOD_TYPES, required: true },
            name: { type: String, default: '', maxlength: 60 },
            holder: { type: String, default: '', maxlength: 80 },
            account: { type: String, default: '', maxlength: 80 },
            note: { type: String, default: '', maxlength: 300 },
            steps: { type: String, default: '', maxlength: 1500 },
            visible: { type: Boolean, default: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    emailNotifications: {
      type: Object.fromEntries(EMAIL_EVENTS.map((key) => [key, { type: Boolean, default: true }])),
      default: () => ({}),
    },
    wholesaleTiers: {
      type: [
        new Schema(
          {
            id: { type: String, required: true },
            name: { type: String, required: true },
            discountPercent: { type: Number, required: true, min: 0, max: 90 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    inventoryStatuses: {
      type: [new Schema({ id: { type: String, required: true }, name: { type: String, required: true } }, { _id: false })],
      default: [],
    },
    inventoryLocations: { type: [String], default: [] },
    requireInspection: { type: Boolean, default: true },
    customerSegments: {
      type: new Schema(
        {
          newDays: { type: Number, default: DEFAULT_SEGMENT_SETTINGS.newDays, min: 1, max: 3650 },
          inactiveDays: { type: Number, default: DEFAULT_SEGMENT_SETTINGS.inactiveDays, min: 1, max: 3650 },
          highSpendMin: { type: Number, default: DEFAULT_SEGMENT_SETTINGS.highSpendMin, min: 0 },
          highProfitMin: { type: Number, default: DEFAULT_SEGMENT_SETTINGS.highProfitMin, min: 0 },
          saved: { type: [Schema.Types.Mixed], default: [] },
        },
        { _id: false }
      ),
      default: () => ({}),
    },
    emailMessages: {
      type: Object.fromEntries(
        EMAIL_MESSAGE_EVENTS.map((key) => [key, { type: String, default: '', maxlength: MAX_EMAIL_MESSAGE }])
      ),
      default: () => ({}),
    },
    notifyStaffLoginEmail: { type: Boolean, default: true },
    homeDeals: { type: [String], default: [] },
    pageHeroProducts: {
      home: { type: String, default: '' },
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

export const MAX_HOME_DEALS = 4;

/** Valid deposit payment methods from admin input (at most MAX_DEPOSIT_METHODS). */
export function sanitizeDepositMethods(input: unknown): DepositMethod[] {
  if (!Array.isArray(input)) return [];
  const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const out: DepositMethod[] = [];
  const ids = new Set<string>();
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const type = DEPOSIT_METHOD_TYPES.includes(r.type as DepositMethodType) ? (r.type as DepositMethodType) : 'other';
    const method = {
      id: text(r.id, 24) || Math.random().toString(36).slice(2, 10),
      type,
      name: text(r.name, 60),
      holder: text(r.holder, 80),
      account: text(r.account, 80),
      note: text(r.note, 300),
      steps: String(r.steps ?? '').replace(/\r\n/g, '\n').trim().slice(0, 1500),
      visible: r.visible !== false,
    };
    if (!method.name && !method.account) continue;
    if (ids.has(method.id)) method.id = Math.random().toString(36).slice(2, 10);
    ids.add(method.id);
    out.push(method);
  }
  return out.slice(0, MAX_DEPOSIT_METHODS);
}

/** Unique, valid product ids for the home page deals, in the given order (max 4). */
export function sanitizeHomeDeals(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const ids = input.map((v) => String(v ?? '').trim()).filter((id) => OBJECT_ID.test(id));
  return [...new Set(ids)].slice(0, MAX_HOME_DEALS);
}

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

/** Segment thresholds with defaults filled in; saved segments validated (max 20). */
export function sanitizeSegmentSettings(
  input: unknown,
  current: Partial<ICustomerSegmentSettings> = {}
): ICustomerSegmentSettings {
  const src = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const num = (key: keyof Omit<ICustomerSegmentSettings, 'saved'>, min: number, max: number) => {
    const raw = src[key] ?? current[key] ?? DEFAULT_SEGMENT_SETTINGS[key];
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : DEFAULT_SEGMENT_SETTINGS[key];
  };
  const savedInput = Array.isArray(src.saved) ? src.saved : current.saved ?? [];
  const saved: ICustomerSegmentSettings['saved'] = [];
  for (const row of savedInput) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? '').trim().slice(0, 40);
    if (!name || typeof r.filters !== 'object' || !r.filters) continue;
    const filters: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(r.filters as Record<string, unknown>)) {
      if (!/^[a-zA-Z]{1,24}$/.test(k)) continue;
      if (typeof v === 'number' && Number.isFinite(v)) filters[k] = v;
      else if (typeof v === 'string' && v.length <= 60) filters[k] = v;
    }
    const id = String(r.id ?? '').replace(/[^a-z0-9-]/gi, '').slice(0, 24) || Math.random().toString(36).slice(2, 10);
    saved.push({ id, name, filters });
    if (saved.length >= 20) break;
  }
  return {
    newDays: num('newDays', 1, 3650),
    inactiveDays: num('inactiveDays', 1, 3650),
    highSpendMin: num('highSpendMin', 0, 1e9),
    highProfitMin: num('highProfitMin', 0, 1e9),
    saved,
  };
}

/** Custom holding statuses: unique ids (slug of the name), max 20. */
export function sanitizeInventoryStatuses(input: unknown): { id: string; name: string }[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: { id: string; name: string }[] = [];
  for (const row of input) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? '').trim().slice(0, 40);
    let id = String(r.id ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24);
    if (!id) id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
    if (!name || !id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name });
    if (out.length >= 20) break;
  }
  return out;
}

export function sanitizeLocations(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((v) => String(v ?? '').trim().slice(0, 80)).filter(Boolean))].slice(0, 50);
}

/** Whether an automatic email type is switched on (on unless explicitly turned off). */
export function isEmailEnabled(settings: Pick<ISettings, 'emailNotifications'>, event: EmailEvent) {
  return settings.emailNotifications?.[event] !== false;
}

/** Fields only staff may read (pricing tiers, segment rules, email configuration). */
const PRIVATE_SETTINGS = ['depositMethods', 'depositInstructions', 'wholesaleTiers', 'customerSegments', 'inventoryStatuses', 'inventoryLocations', 'requireInspection', 'emailNotifications', 'emailMessages', 'notifyStaffLoginEmail'] as const;

/** Settings safe for the public storefront. */
export function publicSettings(settings: ISettings) {
  const plain = (typeof (settings as { toObject?: () => object }).toObject === 'function'
    ? (settings as unknown as { toObject: () => Record<string, unknown> }).toObject()
    : { ...(settings as unknown as Record<string, unknown>) }) as Record<string, unknown>;
  for (const key of PRIVATE_SETTINGS) delete plain[key];
  return plain;
}

export async function getSettings(): Promise<ISettings> {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
}
