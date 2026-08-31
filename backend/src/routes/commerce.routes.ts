import { Router } from 'express';
import * as order from '../controllers/order.controller';
import * as misc from '../controllers/misc.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requirePermission, optionalAuth } from '../middleware/auth';
import { orderLimiter } from '../middleware/rateLimit';
import {
  createOrderSchema,
  updateOrderItemsSchema,
  updateOrderStatusSchema,
  validateCouponSchema,
  guestOrderReceiptSchema,
  reviewSchema,
  couponSchema,
  settingsSchema,
  contactSchema,
  newsletterSchema,
  setUserRoleSchema,
  createStaffUserSchema,
} from '../validators/schemas';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages, try again later' },
});

const router = Router();

router.post(
  '/orders',
  optionalAuth,
  orderLimiter,
  validate(createOrderSchema),
  order.createOrder
);
router.get('/orders', requireAuth, order.myOrders);
router.post(
  '/orders/:orderNumber/receipt',
  orderLimiter,
  validate(guestOrderReceiptSchema),
  order.guestOrderReceipt
);
router.post('/orders/:orderNumber/cancel', requireAuth, order.cancelMyOrder);
router.patch(
  '/orders/:orderNumber/items',
  requireAuth,
  validate(updateOrderItemsSchema),
  order.updateMyOrderItems
);
router.get('/orders/:orderNumber', requireAuth, order.myOrder);
router.post('/coupons/validate', optionalAuth, validate(validateCouponSchema), order.validateCoupon);

router.get('/admin/orders', requireAuth, requirePermission('orders:read'), order.adminOrders);
router.get('/admin/orders/:id', requireAuth, requirePermission('orders:read'), order.adminOrder);
router.patch(
  '/admin/orders/:id/status',
  requireAuth,
  requirePermission('orders:write'),
  validate(updateOrderStatusSchema),
  order.updateOrderStatus
);

router.get('/products/:id/reviews', misc.productReviews);
router.post('/reviews', requireAuth, validate(reviewSchema), misc.createReview);
router.get('/reviews/me', requireAuth, misc.myReviews);
router.get('/admin/reviews', requireAuth, requirePermission('reviews'), misc.adminReviews);
router.patch('/admin/reviews/:id', requireAuth, requirePermission('reviews'), misc.moderateReview);
router.delete('/admin/reviews/:id', requireAuth, requirePermission('reviews'), misc.deleteReview);

router.get('/wishlist', requireAuth, misc.getWishlist);
router.post(
  '/wishlist',
  requireAuth,
  validate(z.object({ productId: z.string().min(1) })),
  misc.addWishlist
);
router.delete('/wishlist/:productId', requireAuth, misc.removeWishlist);
router.post(
  '/wishlist/sync',
  requireAuth,
  validate(z.object({ productIds: z.array(z.string()) })),
  misc.syncWishlist
);

router.get('/notifications', requireAuth, misc.getNotifications);
router.patch('/notifications/:id/read', requireAuth, misc.readNotification);
router.post('/notifications/read-all', requireAuth, misc.readAllNotifications);

router.get('/admin/coupons', requireAuth, requirePermission('coupons'), misc.listCoupons);
router.post(
  '/admin/coupons',
  requireAuth,
  requirePermission('coupons'),
  validate(couponSchema),
  misc.createCoupon
);
router.patch(
  '/admin/coupons/:id',
  requireAuth,
  requirePermission('coupons'),
  validate(couponSchema.partial()),
  misc.updateCoupon
);
router.delete('/admin/coupons/:id', requireAuth, requirePermission('coupons'), misc.deleteCoupon);

router.get(
  '/admin/dashboard',
  requireAuth,
  requirePermission(
    'dashboard',
    'orders:read',
    'inventory:write',
    'messages',
    'coupons',
    'reviews'
  ),
  misc.dashboard
);
router.get('/admin/customers', requireAuth, requirePermission('customers:read'), misc.customers);
router.patch(
  '/admin/customers/:id',
  requireAuth,
  requirePermission('customers:write'),
  misc.setCustomerActive
);
router.get('/admin/users', requireAuth, requirePermission('users:manage'), misc.users);
router.post(
  '/admin/users',
  requireAuth,
  requirePermission('users:manage'),
  validate(createStaffUserSchema),
  misc.createUser
);
router.patch(
  '/admin/users/:id/role',
  requireAuth,
  requirePermission('users:manage'),
  validate(setUserRoleSchema),
  misc.setUserRole
);
router.get('/admin/messages', requireAuth, requirePermission('messages'), misc.listMessages);
router.patch('/admin/messages/:id', requireAuth, requirePermission('messages'), misc.updateMessage);
router.get('/admin/subscribers', requireAuth, requirePermission('messages'), misc.listSubscribers);

router.get('/settings', misc.getStoreSettings);
router.patch(
  '/admin/settings',
  requireAuth,
  requirePermission('settings'),
  validate(settingsSchema),
  misc.updateStoreSettings
);

router.post('/contact', contactLimiter, validate(contactSchema), misc.submitContact);
router.post('/newsletter', contactLimiter, validate(newsletterSchema), misc.subscribeNewsletter);

export default router;
