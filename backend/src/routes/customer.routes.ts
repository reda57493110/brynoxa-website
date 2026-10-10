import { Router } from 'express';
import * as customer from '../controllers/customer.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  refundSchema,
  updateCustomerSchema,
  wholesaleApplicationSchema,
  wholesaleReviewSchema,
} from '../validators/schemas';

const router = Router();

// Admin customer management (literal paths before /:id)
router.get('/admin/customers', requireAuth, requirePermission('customers:read'), customer.list);
router.get('/admin/customers/summary', requireAuth, requirePermission('customers:read'), customer.summary);
router.get('/admin/customers/export', requireAuth, requirePermission('customers:read'), customer.exportCsv);
router.get('/admin/customers/:id', requireAuth, requirePermission('customers:read'), customer.profile);
router.patch(
  '/admin/customers/:id',
  requireAuth,
  requirePermission('customers:write'),
  validate(updateCustomerSchema),
  customer.update
);
router.post(
  '/admin/customers/:id/wholesale',
  requireAuth,
  requirePermission('customers:write'),
  validate(wholesaleReviewSchema),
  customer.review
);
router.post(
  '/admin/orders/:id/refunds',
  requireAuth,
  requirePermission('orders:write'),
  validate(refundSchema),
  customer.refund
);

// Customer wholesale account
router.get('/wholesale/me', requireAuth, customer.myWholesale);
router.get('/wholesale/pricing', requireAuth, customer.myPricing);
router.post('/wholesale/application', requireAuth, validate(wholesaleApplicationSchema), customer.applyWholesale);

export default router;
