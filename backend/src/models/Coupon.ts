import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  /** percent / fixed: off the order; price: a special price on chosen products (e.g. for a friend) */
  type: 'percent' | 'fixed' | 'price';
  value: number;
  /** type "price": what the customer pays per unit of each product */
  productPrices: { product: Types.ObjectId; price: number }[];
  minOrder: number;
  maxUses: number;
  /** How many orders one customer may place with it (0 = no limit). */
  perCustomerLimit: number;
  usedCount: number;
  startsAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    type: { type: String, enum: ['percent', 'fixed', 'price'], required: true },
    value: { type: Number, required: true, min: 0 },
    productPrices: {
      type: [new Schema({ product: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, price: { type: Number, required: true, min: 0 } }, { _id: false })],
      default: [],
    },
    minOrder: { type: Number, default: 0 },
    maxUses: { type: Number, default: 0 },
    perCustomerLimit: { type: Number, default: 0, min: 0 },
    usedCount: { type: Number, default: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Coupon = mongoose.model<ICoupon>('Coupon', couponSchema);
