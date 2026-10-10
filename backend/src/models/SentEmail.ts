import mongoose, { Document, Schema, Types } from 'mongoose';

/** Log of emails written by staff from the admin "Emails" page. */
export interface ISentEmail extends Document {
  to: string;
  subject: string;
  message: string;
  order?: Types.ObjectId;
  orderNumber?: string;
  sentBy: Types.ObjectId;
  status: 'sent' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const sentEmailSchema = new Schema<ISentEmail>(
  {
    to: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, required: true, maxlength: 150 },
    message: { type: String, required: true, maxlength: 5000 },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    orderNumber: { type: String },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
  },
  { timestamps: true }
);

sentEmailSchema.index({ createdAt: -1 });
sentEmailSchema.index({ to: 1, createdAt: -1 });

export const SentEmail = mongoose.model<ISentEmail>('SentEmail', sentEmailSchema);
