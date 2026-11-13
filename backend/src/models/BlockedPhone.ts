import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * A phone number that may not order on the website (fake orders, parcels refused again and again).
 * Matched by its last 9 digits (`key`), so "06 12 34 56 78" and "+212 612345678" are the same number.
 * Staff can still enter an order for it by hand (Admin → Orders → New order).
 */
export interface IBlockedPhone extends Document {
  key: string;
  phone: string;
  reason?: string;
  by?: Types.ObjectId;
  createdAt: Date;
}

const blockedPhoneSchema = new Schema<IBlockedPhone>(
  {
    key: { type: String, required: true, unique: true },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    reason: { type: String, trim: true, maxlength: 300 },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const BlockedPhone = mongoose.model<IBlockedPhone>('BlockedPhone', blockedPhoneSchema);
