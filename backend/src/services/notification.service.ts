import { Notification } from '../models/Notification';
import { ApiError } from '../utils/ApiError';

export async function listNotifications(userId: string) {
  return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50);
}

export async function markRead(userId: string, id: string) {
  const n = await Notification.findOneAndUpdate(
    { _id: id, user: userId },
    { isRead: true },
    { new: true }
  );
  if (!n) throw new ApiError(404, 'Notification not found');
  return n;
}

export async function markAllRead(userId: string) {
  await Notification.updateMany({ user: userId, isRead: false }, { isRead: true });
  return listNotifications(userId);
}

export async function unreadCount(userId: string) {
  return Notification.countDocuments({ user: userId, isRead: false });
}
