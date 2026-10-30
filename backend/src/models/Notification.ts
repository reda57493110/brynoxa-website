import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotification extends Document {
  user: Types.ObjectId;
  type: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
// Read notifications are removed by MongoDB after 6 months (unread ones stay until read)
export const READ_NOTIFICATION_DAYS = 180;
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: READ_NOTIFICATION_DAYS * 24 * 60 * 60, partialFilterExpression: { isRead: true } }
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
