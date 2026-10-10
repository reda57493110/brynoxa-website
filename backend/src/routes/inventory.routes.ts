import { Router } from 'express';
import * as inv from '../controllers/inventory.controller';
import { requireAuth, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  assessReturnSchema,
  conditionChangeSchema,
  conditionListingSchema,
  receiptSchema,
  registerSerialsSchema,
  repairCompleteSchema,
  repairUpdateSchema,
  returnSchema,
  stockAdjustmentSchema,
} from '../validators/schemas';

/**
 * Inventory management. All routes need "inventory:write"; approving repaired units, write-offs and
 * stock adjustments additionally need "inventory:approve" (checked in the service layer).
 */
const router = Router();
const staff = [requireAuth, requirePermission('inventory:write')];

router.get('/admin/inventory', ...staff, inv.overview);
router.get('/admin/inventory/summary', ...staff, inv.summary);
router.get('/admin/inventory/movements', ...staff, inv.movements);
router.get('/admin/inventory/products/:id', ...staff, inv.product);
router.post('/admin/inventory/products/:id/listing', ...staff, validate(conditionListingSchema), inv.createListing);
router.post('/admin/inventory/move', ...staff, validate(conditionChangeSchema), inv.move);
router.post('/admin/inventory/adjust', ...staff, validate(stockAdjustmentSchema), inv.adjust);
router.post('/admin/inventory/serials', ...staff, validate(registerSerialsSchema), inv.registerSerials);

router.get('/admin/inventory/receipts', ...staff, inv.receipts);
router.post('/admin/inventory/receipts', ...staff, validate(receiptSchema), inv.receive);

router.get('/admin/inventory/returns', ...staff, inv.returns);
router.get('/admin/inventory/returns/:id', ...staff, inv.returnDetail);
router.post('/admin/inventory/returns/:id/assess', ...staff, validate(assessReturnSchema), inv.assessReturn);
router.post(
  '/admin/orders/:id/returns',
  requireAuth,
  requirePermission('inventory:write', 'orders:write'),
  validate(returnSchema),
  inv.createReturn
);

router.get('/admin/inventory/repairs', ...staff, inv.repairs);
router.get('/admin/inventory/repairs/:id', ...staff, inv.repairDetail);
router.patch('/admin/inventory/repairs/:id', ...staff, validate(repairUpdateSchema), inv.updateRepair);
router.post('/admin/inventory/repairs/:id/complete', ...staff, validate(repairCompleteSchema), inv.completeRepair);

export default router;
