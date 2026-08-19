import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/ApiResponse';
import * as reviewService from '../services/review.service';
import * as wishlistService from '../services/wishlist.service';
import * as notificationService from '../services/notification.service';
import * as couponService from '../services/coupon.service';
import * as adminService from '../services/admin.service';
import { getSettings, Settings } from '../models/Settings';
import { ContactMessage, NewsletterSubscriber } from '../models/Contact';
import { param } from '../utils/params';

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const result = await reviewService.createReview({
    userId: req.user!.userId,
    productId: req.body.productId,
    rating: req.body.rating,
    title: req.body.title,
    comment: req.body.comment,
  });
  sendSuccess(res, result, 'Review submitted', 201);
});

export const productReviews = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await reviewService.listProductReviews(param(req, 'id'), page, limit);
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const myReviews = asyncHandler(async (req: Request, res: Response) => {
  const items = await reviewService.listUserReviews(req.user!.userId);
  sendSuccess(res, items);
});

export const adminReviews = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const result = await reviewService.listAllReviews(page, limit);
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const moderateReview = asyncHandler(async (req: Request, res: Response) => {
  const item = await reviewService.moderateReview(param(req, 'id'), Boolean(req.body.isApproved));
  sendSuccess(res, item, 'Review updated');
});

export const deleteReview = asyncHandler(async (req: Request, res: Response) => {
  await reviewService.deleteReview(param(req, 'id'));
  sendSuccess(res, null, 'Review deleted');
});

export const getWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await wishlistService.getWishlist(req.user!.userId);
  sendSuccess(res, wishlist);
});

export const addWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await wishlistService.addToWishlist(req.user!.userId, req.body.productId);
  sendSuccess(res, wishlist, 'Added to wishlist');
});

export const removeWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await wishlistService.removeFromWishlist(req.user!.userId, param(req, 'productId'));
  sendSuccess(res, wishlist, 'Removed from wishlist');
});

export const syncWishlist = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await wishlistService.syncWishlist(req.user!.userId, req.body.productIds || []);
  sendSuccess(res, wishlist, 'Wishlist synced');
});

export const getNotifications = asyncHandler(async (req: Request, res: Response) => {
  const items = await notificationService.listNotifications(req.user!.userId);
  const unread = await notificationService.unreadCount(req.user!.userId);
  sendSuccess(res, { items, unread });
});

export const readNotification = asyncHandler(async (req: Request, res: Response) => {
  const item = await notificationService.markRead(req.user!.userId, param(req, 'id'));
  sendSuccess(res, item);
});

export const readAllNotifications = asyncHandler(async (req: Request, res: Response) => {
  const items = await notificationService.markAllRead(req.user!.userId);
  sendSuccess(res, items);
});

export const listCoupons = asyncHandler(async (_req: Request, res: Response) => {
  const items = await couponService.listCoupons();
  sendSuccess(res, items);
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const item = await couponService.createCoupon(req.body);
  sendSuccess(res, item, 'Coupon created', 201);
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const item = await couponService.updateCoupon(param(req, 'id'), req.body);
  sendSuccess(res, item, 'Coupon updated');
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  await couponService.deleteCoupon(param(req, 'id'));
  sendSuccess(res, null, 'Coupon deleted');
});

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const stats = await adminService.getDashboardStats();
  sendSuccess(res, stats);
});

export const customers = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const result = await adminService.listCustomers(page, limit, q);
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const setCustomerActive = asyncHandler(async (req: Request, res: Response) => {
  const user = await adminService.setCustomerActive(param(req, 'id'), Boolean(req.body.isActive));
  sendSuccess(res, user, 'Customer updated');
});

export const listMessages = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const result = await adminService.listMessages(page, limit, status);
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const updateMessage = asyncHandler(async (req: Request, res: Response) => {
  const item = await adminService.updateMessageStatus(
    param(req, 'id'),
    req.body.status as 'new' | 'read' | 'archived'
  );
  sendSuccess(res, item, 'Message updated');
});

export const listSubscribers = asyncHandler(async (_req: Request, res: Response) => {
  const items = await adminService.listSubscribers();
  sendSuccess(res, items);
});

export const getStoreSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await getSettings();
  sendSuccess(res, settings);
});

export const updateStoreSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await getSettings();
  Object.assign(settings, req.body);
  await settings.save();
  sendSuccess(res, settings, 'Settings updated');
});

export const submitContact = asyncHandler(async (req: Request, res: Response) => {
  const doc = await ContactMessage.create(req.body);
  sendSuccess(res, { id: doc._id }, 'Message received', 201);
});

export const subscribeNewsletter = asyncHandler(async (req: Request, res: Response) => {
  const email = String(req.body.email).toLowerCase();
  const existing = await NewsletterSubscriber.findOne({ email });
  if (existing) {
    if (!existing.isActive) {
      existing.isActive = true;
      await existing.save();
    }
    sendSuccess(res, { email }, 'Already subscribed');
    return;
  }
  await NewsletterSubscriber.create({ email });
  sendSuccess(res, { email }, 'Subscribed', 201);
});

void Settings;
