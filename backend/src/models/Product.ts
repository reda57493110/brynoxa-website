import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProductImage {
  url: string;
  publicId?: string;
  alt?: string;
  isPrimary: boolean;
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
  stock: number;
  lowStockThreshold: number;
  specs: Map<string, string> | Record<string, string>;
  tags: string[];
  isFeatured: boolean;
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
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    specs: { type: Map, of: String, default: {} },
    tags: [{ type: String }],
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    soldCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, brand: 1, price: 1, isActive: 1 });
productSchema.index({ isFeatured: 1, isActive: 1 });

export const Product = mongoose.model<IProduct>('Product', productSchema);
