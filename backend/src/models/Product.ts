import mongoose, { Document, Schema, Types } from 'mongoose';
import type { ProductDepositRule } from '../utils/deposit';

export interface IProductImage {
  url: string;
  publicId?: string;
  alt?: string;
  isPrimary: boolean;
}

export type ProductCondition = 'new' | 'refurbished' | 'used';

/** Non-sellable unit counts. Sellable units are Product.stock. Changed only through the inventory ledger. */
export interface IProductInventory {
  reserved: number;
  awaitingInspection: number;
  returned: number;
  defective: number;
  underRepair: number;
  writtenOff: number;
  /** Counts for custom holding statuses defined in Settings (key = status id). */
  custom: Map<string, number>;
  /** Units without a known cost (stock that existed before costs were recorded). */
  uncosted: number;
}

export interface IProduct extends Document {
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription?: string;
  category: Types.ObjectId;
  brand: Types.ObjectId;
  images: IProductImage[];
  price: number;
  compareAtPrice?: number;
  /** What the product costs Brynoxa (staff only — never sent to shoppers). Used for profit reports. */
  costPrice?: number;
  /** Optional upfront deposit for cash-on-delivery orders; absent means none. */
  deposit?: ProductDepositRule;
  /** Hand-picked "Complete your setup" products, shown first in this order. */
  recommended: Types.ObjectId[];
  /** When true, only `recommended` is shown — no automatic suggestions. */
  recommendedOnly: boolean;
  /** Units for sale on this listing (checkout uses this). */
  stock: number;
  lowStockThreshold: number;
  /** Condition of the units this listing sells; shown to customers. */
  condition: ProductCondition;
  /** Honest description of a used / refurbished listing (shown on the product page). */
  conditionNote?: string;
  /** Track every unit by serial number instead of by quantity only. */
  serialTracking: boolean;
  /** For refurbished / used listings: the new model they come from. */
  baseProduct?: Types.ObjectId;
  /** Default storage location (warehouse, shelf…). */
  inventoryLocation?: string;
  inventory?: IProductInventory;
  specs: Map<string, string> | Record<string, string>;
  /** Spec form used for this product (see utils/specs.ts); empty = from its category. */
  specTemplate?: string;
  tags: string[];
  isFeatured: boolean;
  featuredAt?: Date | null;
  isCarousel: boolean;
  carouselAt?: Date | null;
  isActive: boolean;
  averageRating: number;
  reviewCount: number;
  soldCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const imageSchema = new Schema<IProductImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    alt: { type: String },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const depositRuleSchema = new Schema<ProductDepositRule>(
  {
    type: { type: String, enum: ['fixed', 'percent'], required: true },
    value: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    sku: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String, required: true },
    shortDescription: { type: String },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    brand: { type: Schema.Types.ObjectId, ref: 'Brand', required: true },
    images: [imageSchema],
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    costPrice: { type: Number, min: 0, select: false },
    deposit: { type: depositRuleSchema, default: undefined },
    recommended: { type: [{ type: Schema.Types.ObjectId, ref: 'Product' }], default: [] },
    recommendedOnly: { type: Boolean, default: false },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    condition: { type: String, enum: ['new', 'refurbished', 'used'], default: 'new' },
    conditionNote: { type: String, maxlength: 500 },
    serialTracking: { type: Boolean, default: false },
    baseProduct: { type: Schema.Types.ObjectId, ref: 'Product' },
    inventoryLocation: { type: String, maxlength: 80 },
    inventory: {
      type: new Schema(
        {
          reserved: { type: Number, default: 0, min: 0 },
          awaitingInspection: { type: Number, default: 0, min: 0 },
          returned: { type: Number, default: 0, min: 0 },
          defective: { type: Number, default: 0, min: 0 },
          underRepair: { type: Number, default: 0, min: 0 },
          writtenOff: { type: Number, default: 0, min: 0 },
          custom: { type: Map, of: Number, default: {} },
          uncosted: { type: Number, default: 0, min: 0 },
        },
        { _id: false }
      ),
      default: undefined,
      select: false,
    },
    specs: { type: Map, of: String, default: {} },
    specTemplate: { type: String, default: undefined },
    tags: [{ type: String }],
    isFeatured: { type: Boolean, default: false },
    featuredAt: { type: Date, default: null },
    isCarousel: { type: Boolean, default: false },
    carouselAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', tags: 'text', shortDescription: 'text' });
productSchema.index({ category: 1, brand: 1, price: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, isActive: 1, featuredAt: -1 });
productSchema.index({ isCarousel: 1, isActive: 1, carouselAt: -1 });
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, soldCount: -1 });
productSchema.index({ isActive: 1, averageRating: -1 });
productSchema.index({ isActive: 1, stock: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
