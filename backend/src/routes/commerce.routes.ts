import { Router } from 'express';
import * as order from '../controllers/order.controller';
import * as misc from '../controllers/misc.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { orderLimiter } from '../middleware/rateLimit';
import {
  createOrderSchema,
  updateOrderStatusSchema,
  validateCouponSchema,
  reviewSchema,
  couponSchema,
  settingsSchema,
} from '../validators/schemas';
import { z } from 'zod';

const router = Router();

router.post(
  '/orders',
  requireAuth,
  orderLimiter,
  validate(createOrderSchema),
  order.createOrder
);
router.get('/orders', requireAuth, order.myOrders);
router.get('/orders/:orderNumber', requireAuth, order.myOrder);
router.post('/coupons/validate', requireAuth, validate(validateCouponSchema), order.validateCoupon);

router.get('/admin/orders', requireAuth, requireAdmin, order.adminOrders);
router.get('/admin/orders/:id', requireAuth, requireAdmin, order.adminOrder);
router.patch(
  '/admin/orders/:id/status',
  requireAuth,
  requireAdmin,
  validate(updateOrderStatusSchema),
  order.updateOrderStatus
);

router.get('/products/:id/reviews', misc.productReviews);
router.post('/reviews', requireAuth, validate(reviewSchema), misc.createReview);
router.get('/reviews/me', requireAuth, misc.myReviews);
router.get('/admin/reviews', requireAuth, requireAdmin, misc.adminReviews);
router.patch('/admin/reviews/:id', requireAuth, requireAdmin, misc.moderateReview);
router.delete('/admin/reviews/:id', requireAuth, requireAdmin, misc.deleteReview);

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

router.get('/admin/coupons', requireAuth, requireAdmin, misc.listCoupons);
router.post('/admin/coupons', requireAuth, requireAdmin, validate(couponSchema), misc.createCoupon);
router.patch(
  '/admin/coupons/:id',
  requireAuth,
  requireAdmin,
  validate(couponSchema.partial()),
  misc.updateCoupon
);
router.delete('/admin/coupons/:id', requireAuth, requireAdmin, misc.deleteCoupon);

router.get('/admin/dashboard', requireAuth, requireAdmin, misc.dashboard);
router.get('/admin/customers', requireAuth, requireAdmin, misc.customers);
router.patch('/admin/customers/:id', requireAuth, requireAdmin, misc.setCustomerActive);

router.get('/settings', misc.getStoreSettings);
router.patch(
  '/admin/settings',
  requireAuth,
  requireAdmin,
  validate(settingsSchema),
  misc.updateStoreSettings
);

export default router;
