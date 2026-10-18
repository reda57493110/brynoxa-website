import mongoose, { Schema, Document, Types } from 'mongoose';

/**
 * Photo staff add as proof of a deposit (bank screenshot, Cash Plus slip…). Private: served only to
 * staff and to the customer who owns the order. Listed on the order in `deposit.proofs`.
 */
export interface IDepositProof extends Document {
  order: Types.ObjectId;
  data: Buffer;
  contentType: string;
  size: number;
  addedBy?: Types.ObjectId;
}

const depositProofSchema = new Schema<IDepositProof>(
  {
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    data: { type: Buffer, required: true },
    contentType: { type: String, required: true },
    size: { type: Number, required: true },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const DepositProof = mongoose.model<IDepositProof>('DepositProof', depositProofSchema);
