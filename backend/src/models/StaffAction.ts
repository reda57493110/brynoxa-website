import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * One change made by a staff member (Admin → Roles → activity): what they did, on what, when.
 * Written after the change succeeded; kept for a year.
 */
export interface IStaffAction extends Document {
  user: Types.ObjectId;
  role: string;
  /** Short readable label, e.g. "Edited a product" */
  action: string;
  /** What it was done on, to link to it: order, product, customer… */
  kind: string;
  targetId?: string;
  method: string;
  path: string;
  at: Date;
}

const staffActionSchema = new Schema<IStaffAction>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true },
  action: { type: String, required: true, maxlength: 120 },
  kind: { type: String, required: true, maxlength: 40 },
  targetId: { type: String, maxlength: 60 },
  method: { type: String, required: true, maxlength: 10 },
  path: { type: String, required: true, maxlength: 300 },
  at: { type: Date, default: Date.now },
});

staffActionSchema.index({ user: 1, at: -1 });
staffActionSchema.index({ at: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export const StaffAction = mongoose.model<IStaffAction>('StaffAction', staffActionSchema);
