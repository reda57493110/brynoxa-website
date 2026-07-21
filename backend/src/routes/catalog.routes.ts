import { Router } from 'express';
import * as catalog from '../controllers/catalog.controller';
import { validate } from '../middleware/validate';
import { optionalAuth, requireAuth, requireAdmin } from '../middleware/auth';
import { upload } from '../middleware/upload';
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
  requireAdmin,
  validate(categorySchema),
  catalog.createCategory
);
router.patch(
  '/admin/categories/:id',
  requireAuth,
  requireAdmin,
  validate(categorySchema.partial()),
  catalog.updateCategory
);
router.delete('/admin/categories/:id', requireAuth, requireAdmin, catalog.deleteCategory);

router.get('/brands', optionalAuth, catalog.getBrands);
router.post('/admin/brands', requireAuth, requireAdmin, validate(brandSchema), catalog.createBrand);
router.patch(
  '/admin/brands/:id',
  requireAuth,
  requireAdmin,
  validate(brandSchema.partial()),
  catalog.updateBrand
);
router.delete('/admin/brands/:id', requireAuth, requireAdmin, catalog.deleteBrand);

router.get('/products', optionalAuth, catalog.getProducts);
router.get('/products/compare', catalog.compareProducts);
router.get('/products/:slug', catalog.getProduct);
router.get('/admin/products/:id', requireAuth, requireAdmin, catalog.getProductAdmin);
router.post(
  '/admin/products',
  requireAuth,
  requireAdmin,
  validate(productSchema),
  catalog.createProduct
);
router.patch(
  '/admin/products/:id',
  requireAuth,
  requireAdmin,
  validate(productSchema.partial()),
  catalog.updateProduct
);
router.delete('/admin/products/:id', requireAuth, requireAdmin, catalog.deleteProduct);
router.patch(
  '/admin/products/:id/inventory',
  requireAuth,
  requireAdmin,
  validate(inventorySchema),
  catalog.updateInventory
);
router.post(
  '/admin/upload',
  requireAuth,
  requireAdmin,
  upload.single('image'),
  catalog.uploadImage
);

export default router;
