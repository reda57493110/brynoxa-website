import { Router } from 'express';
import * as catalog from '../controllers/catalog.controller';
import { validate } from '../middleware/validate';
import { optionalAuth, requireAuth, requirePermission } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { uploadLimiter } from '../middleware/rateLimit';
import {
  categorySchema,
  brandSchema,
  productSchema,
  inventorySchema,
} from '../validators/schemas';

const router = Router();

router.get('/categories', optionalAuth, catalog.getCategories);
router.get('/categories/:slug', catalog.getCategory);
router.post(
  '/admin/categories',
  requireAuth,
  requirePermission('products:write'),
  validate(categorySchema),
  catalog.createCategory
);
router.patch(
  '/admin/categories/:id',
  requireAuth,
  requirePermission('products:write'),
  validate(categorySchema.partial()),
  catalog.updateCategory
);
router.delete(
  '/admin/categories/:id',
  requireAuth,
  requirePermission('products:write'),
  catalog.deleteCategory
);

router.get('/brands', optionalAuth, catalog.getBrands);
router.post(
  '/admin/brands',
  requireAuth,
  requirePermission('products:write'),
  validate(brandSchema),
  catalog.createBrand
);
router.patch(
  '/admin/brands/:id',
  requireAuth,
  requirePermission('products:write'),
  validate(brandSchema.partial()),
  catalog.updateBrand
);
router.delete(
  '/admin/brands/:id',
  requireAuth,
  requirePermission('products:write'),
  catalog.deleteBrand
);

router.get('/products', optionalAuth, catalog.getProducts);
router.get('/products/compare', catalog.compareProducts);
router.get('/products/:slug', catalog.getProduct);
router.get(
  '/admin/products/:id',
  requireAuth,
  requirePermission('products:read'),
  catalog.getProductAdmin
);
router.post(
  '/admin/products',
  requireAuth,
  requirePermission('products:write'),
  validate(productSchema),
  catalog.createProduct
);
router.patch(
  '/admin/products/:id',
  requireAuth,
  requirePermission('products:write'),
  validate(productSchema.partial()),
  catalog.updateProduct
);
router.delete(
  '/admin/products/:id',
  requireAuth,
  requirePermission('products:delete'),
  catalog.deleteProduct
);
router.patch(
  '/admin/products/:id/inventory',
  requireAuth,
  requirePermission('inventory:write'),
  validate(inventorySchema),
  catalog.updateInventory
);
router.post(
  '/admin/upload',
  requireAuth,
  requirePermission('products:write', 'inventory:write'),
  uploadLimiter,
  upload.single('image'),
  catalog.uploadImage
);

export default router;
