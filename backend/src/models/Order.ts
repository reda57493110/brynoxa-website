import mongoose, { Document, Schema, Types } from 'mongoose';
import { IAddress } from './User';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image?: string;
  sku: string;
  price: number;
  qty: number;
}

export interface IOrderTimeline {
  status: OrderStatus;
  note?: string;
  at: Date;
}

export interface IOrder extends Document {
  orderNumber: string;
  user: Types.ObjectId;
  items: IOrderItem[];
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
  };
  coupon?: {
    code: string;
    couponId?: Types.ObjectId;
  };
  shippingAddress: IAddress;
  paymentMethod: 'cod';
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  timeline: IOrderTimeline[];
  customerNote?: string;
  adminNote?: string;
  stockReserved: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    image: { type: String },
    sku: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const timelineSchema = new Schema<IOrderTimeline>(
  {
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      required: true,
    },
    note: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    pricing: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: { type: Number, required: true },
    },
    coupon: {
      code: { type: String },
      couponId: { type: Schema.Types.ObjectId, ref: 'Coupon' },
    },
    shippingAddress: {
      label: String,
      fullName: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: String,
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, required: true },
      isDefault: Boolean,
    },
    paymentMethod: { type: String, enum: ['cod'], default: 'cod' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    timeline: [timelineSchema],
    customerNote: { type: String },
    adminNote: { type: String },
    stockReserved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
