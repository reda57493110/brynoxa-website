import mongoose, { Document, Schema, Types } from 'mongoose';
import { IAddress } from './User';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface IOrderItem {
  product: Types.ObjectId;
  name: string;
  image?: string;
  sku: string;
  /** Price actually charged per unit (after any wholesale discount). */
  price: number;
  qty: number;
  /** Catalog price per unit at order time; differs from price on wholesale orders. */
  listPrice?: number;
  /** Serial numbers of the units reserved for this line (serial-tracked products). */
  serials?: string[];
  /** Condition of the listing when ordered (new / refurbished / used). */
  condition?: string;
  /** Product cost per unit at order time; missing on orders placed before costs were recorded. */
  unitCost?: number;
}

/** A refund recorded by staff (money given back to the customer). */
export interface IOrderRefund {
  amount: number;
  reason: string;
  itemsReturned: boolean;
  at: Date;
  by?: Types.ObjectId;
}

/**
 * Upfront deposit for a COD order. `products` = from product rules at checkout,
 * `admin` = set by staff on the order. The rest is paid on delivery.
 */
export interface IOrderDeposit {
  amount: number;
  source: 'products' | 'admin';
  status: 'pending' | 'received';
  receivedAt?: Date;
}

export interface IOrderTimeline {
  status: OrderStatus;
  note?: string;
  at: Date;
}

export interface IOrder extends Document {
  orderNumber: string;
  receiptTokenHash?: string;
  user: Types.ObjectId;
  items: IOrderItem[];
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    tax: number;
    total: number;
    /** Wholesale tier discount included in the item prices (list − charged). */
    wholesaleDiscount?: number;
  };
  /** Sales channel when the order was placed; never changes afterwards. */
  channel: 'retail' | 'wholesale';
  wholesaleTier?: { id: string; name: string; discountPercent: number };
  refunds: IOrderRefund[];
  coupon?: {
    code: string;
    couponId?: Types.ObjectId;
  };
  shippingAddress: IAddress;
  paymentMethod: 'cod';
  paymentStatus: PaymentStatus;
  deposit?: IOrderDeposit;
  orderStatus: OrderStatus;
  timeline: IOrderTimeline[];
  customerNote?: string;
  adminNote?: string;
  stockReserved: boolean;
  /** Stock for this order goes through the inventory ledger (reserved bucket). Older orders: false. */
  inventoryLedger?: boolean;
  /** Units have left the store (order shipped). */
  stockDispatched?: boolean;
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
    listPrice: { type: Number },
    serials: { type: [String], default: undefined },
    condition: { type: String },
    // Staff-only: queries that need it use .select('+items.unitCost')
    unitCost: { type: Number, select: false },
  },
  { _id: false }
);

const timelineSchema = new Schema<IOrderTimeline>(
  {
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      required: true,
    },
    note: { type: String },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const depositSchema = new Schema<IOrderDeposit>(
  {
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, enum: ['products', 'admin'], required: true },
    status: { type: String, enum: ['pending', 'received'], default: 'pending' },
    receivedAt: { type: Date },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true },
    receiptTokenHash: { type: String, select: false },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: { type: [orderItemSchema], required: true },
    pricing: {
      subtotal: { type: Number, required: true },
      discount: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: { type: Number, required: true },
      wholesaleDiscount: { type: Number, default: 0 },
    },
    channel: { type: String, enum: ['retail', 'wholesale'], default: 'retail' },
    wholesaleTier: {
      type: new Schema({ id: String, name: String, discountPercent: Number }, { _id: false }),
      default: undefined,
    },
    refunds: {
      type: [
        new Schema(
          {
            amount: { type: Number, required: true, min: 0.01 },
            reason: { type: String, required: true, maxlength: 300 },
            itemsReturned: { type: Boolean, default: false },
            at: { type: Date, default: Date.now },
            by: { type: Schema.Types.ObjectId, ref: 'User' },
          },
          { _id: false }
        ),
      ],
      default: [],
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
      postalCode: { type: String, default: '00000' },
      country: { type: String, default: 'MA' },
      phone: { type: String, required: true },
      isDefault: Boolean,
    },
    paymentMethod: { type: String, enum: ['cod'], default: 'cod' },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    deposit: { type: depositSchema, default: undefined },
    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    timeline: [timelineSchema],
    customerNote: { type: String },
    adminNote: { type: String },
    stockReserved: { type: Boolean, default: false },
    inventoryLedger: { type: Boolean, default: false },
    stockDispatched: { type: Boolean, default: false },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ receiptTokenHash: 1 }, { sparse: true });
orderSchema.index({ user: 1, orderStatus: 1, 'items.product': 1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
