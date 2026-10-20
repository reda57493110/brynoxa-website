import mongoose, { Document, Schema, Types } from 'mongoose';
import { IAddress } from './User';
import { DELIVERY_ISSUES, ORDER_STATUSES, type DeliveryIssue, type OrderStatus } from '../utils/orderStatus';

export type { OrderStatus, DeliveryIssue };

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
  /** Units of this line registered as returned (customer returns or failed deliveries). */
  returnedQty?: number;
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
  /** What the customer reported after paying (staff still checks and marks it received). */
  payment?: IDepositPayment;
  /** Proof photos added by staff (images in DepositProof), oldest first */
  proofs?: IDepositProofRef[];
  /** Payment options shown to this customer; empty = all visible ones */
  methodIds?: string[];
  /** Transfer fees the shop covers (taken off what the courier collects) */
  feeCredit?: number;
}

export interface IDepositProofRef {
  id: string;
  addedAt: Date;
  addedByName?: string;
}

export interface IDepositPayment {
  methodId: string;
  /** Method name at the time, e.g. "Cash Plus" */
  methodName: string;
  /** Name on the transfer / slip (often not the account holder) */
  payerName?: string;
  senderPhone?: string;
  /** When it was paid (YYYY-MM-DD or YYYY-MM-DDTHH:mm) */
  paidOn?: string;
  /** What the customer says they sent (DH), and the transfer fees they paid */
  amountSent?: number;
  fee?: number;
  /** Agency / city / ATM where they paid */
  place?: string;
  /** ATM cardless withdrawal codes sent by the customer */
  codes?: { label: string; value: string }[];
  reference?: string;
  note?: string;
  hasReceipt: boolean;
  reportedAt: Date;
  /** customer = sent from their order page; staff = recorded in admin */
  source?: 'customer' | 'staff';
}

export interface IOrderTimeline {
  status: OrderStatus;
  note?: string;
  /** Delivery issue / cancellation reason code, when the step has one. */
  reason?: string;
  /** Staff-only remark on this step (never shown to the customer). */
  staffNote?: string;
  /** Staff-only step (audit trail), hidden from the customer's timeline. */
  internal?: boolean;
  at: Date;
  /** Staff member who made the change (absent: customer or system). */
  by?: Types.ObjectId;
}

/** A call / message to the customer, logged by staff. */
export interface IOrderContactAttempt {
  channel: 'call' | 'whatsapp' | 'sms' | 'email';
  outcome: 'reached' | 'no_answer' | 'busy' | 'wrong_number' | 'switched_off' | 'message_sent';
  note?: string;
  at: Date;
  by?: Types.ObjectId;
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
  contactAttempts: IOrderContactAttempt[];
  /** Latest failed delivery (cleared once delivered). */
  deliveryIssue?: { reason: DeliveryIssue; note?: string; at: Date };
  /** Failed delivery attempts so far. */
  deliveryAttempts?: number;
  /** New delivery date agreed with the customer. */
  rescheduledFor?: Date;
  /** First time the order was delivered (cash collected); kept when items come back later. */
  deliveredAt?: Date;
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
    returnedQty: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const timelineSchema = new Schema<IOrderTimeline>(
  {
    status: {
      type: String,
      enum: ORDER_STATUSES,
      required: true,
    },
    note: { type: String },
    reason: { type: String },
    staffNote: { type: String, maxlength: 1000 },
    internal: { type: Boolean },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const contactAttemptSchema = new Schema<IOrderContactAttempt>(
  {
    channel: { type: String, enum: ['call', 'whatsapp', 'sms', 'email'], required: true },
    outcome: {
      type: String,
      enum: ['reached', 'no_answer', 'busy', 'wrong_number', 'switched_off', 'message_sent'],
      required: true,
    },
    note: { type: String, maxlength: 500 },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const depositPaymentSchema = new Schema<IDepositPayment>(
  {
    methodId: { type: String, required: true },
    methodName: { type: String, required: true },
    payerName: { type: String, maxlength: 120 },
    senderPhone: { type: String, maxlength: 30 },
    paidOn: { type: String, maxlength: 20 },
    amountSent: { type: Number, min: 0 },
    fee: { type: Number, min: 0 },
    place: { type: String, maxlength: 120 },
    codes: { type: [{ label: { type: String, maxlength: 40 }, value: { type: String, maxlength: 40 }, _id: false }], default: undefined },
    reference: { type: String, maxlength: 80 },
    note: { type: String, maxlength: 300 },
    hasReceipt: { type: Boolean, default: false },
    reportedAt: { type: Date, required: true },
    source: { type: String, enum: ['customer', 'staff'], default: 'customer' },
  },
  { _id: false }
);

const depositProofRefSchema = new Schema<IDepositProofRef>(
  {
    id: { type: String, required: true },
    addedAt: { type: Date, required: true },
    addedByName: { type: String },
  },
  { _id: false }
);

const depositSchema = new Schema<IOrderDeposit>(
  {
    proofs: { type: [depositProofRefSchema], default: undefined },
    methodIds: { type: [String], default: undefined },
    feeCredit: { type: Number, min: 0 },
    payment: { type: depositPaymentSchema, default: undefined },
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
      enum: ORDER_STATUSES,
      default: 'pending',
    },
    timeline: [timelineSchema],
    contactAttempts: { type: [contactAttemptSchema], default: [] },
    deliveryIssue: {
      type: new Schema(
        { reason: { type: String, enum: DELIVERY_ISSUES, required: true }, note: String, at: { type: Date, default: Date.now } },
        { _id: false }
      ),
      default: undefined,
    },
    deliveryAttempts: { type: Number, default: 0 },
    rescheduledFor: { type: Date },
    deliveredAt: { type: Date },
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
// 'Bought together' lookups for Complete your setup
orderSchema.index({ 'items.product': 1, createdAt: -1 });

export const Order = mongoose.model<IOrder>('Order', orderSchema);
