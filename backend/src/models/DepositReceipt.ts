import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Photo of a deposit payment receipt sent by the customer. Private: kept apart from product
 * images and only served to staff (one per order; a new upload replaces it).
 */
export interface IDepositReceipt extends Document {
  order: Types.ObjectId;
  data: Buffer;
  contentType: string;
  size: number;
}

const depositReceiptSchema = new Schema<IDepositReceipt>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { timestamps: true }
);

export const DepositReceipt = mongoose.model<IDepositReceipt>('DepositReceipt', depositReceiptSchema);
