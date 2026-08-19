import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/ApiResponse';
import * as catalog from '../services/catalog.service';
import { uploadProductImage } from '../services/upload.service';
import { paginationQuerySchema } from '../validators/schemas';
import { param } from '../utils/params';

export const getCategories = asyncHandler(async (req: Request, res: Response) => {
  const admin = req.user?.role === 'admin' && req.query.all === 'true';
  const items = await catalog.listCategories(!admin);
  sendSuccess(res, items);
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.getCategoryBySlug(param(req, 'slug'));
  sendSuccess(res, item);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.createCategory(req.body);
  sendSuccess(res, item, 'Category created', 201);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.updateCategory(param(req, 'id'), req.body);
  sendSuccess(res, item, 'Category updated');
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await catalog.deleteCategory(param(req, 'id'));
  sendSuccess(res, null, 'Category deleted');
});

export const getBrands = asyncHandler(async (req: Request, res: Response) => {
  const admin = req.user?.role === 'admin' && req.query.all === 'true';
  const items = await catalog.listBrands(!admin);
  sendSuccess(res, items);
});

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.createBrand(req.body);
  sendSuccess(res, item, 'Brand created', 201);
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.updateBrand(param(req, 'id'), req.body);
  sendSuccess(res, item, 'Brand updated');
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  await catalog.deleteBrand(param(req, 'id'));
  sendSuccess(res, null, 'Brand deleted');
});

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const query = paginationQuerySchema.parse(req.query);
  const admin = req.user?.role === 'admin' && req.query.admin === 'true';
  const isActive =
    req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
  const result = await catalog.listProducts({ ...query, admin, isActive });
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.getProductBySlug(param(req, 'slug'));
  sendSuccess(res, item);
});

export const getProductAdmin = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.getProductById(param(req, 'id'));
  sendSuccess(res, item);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.createProduct(req.body);
  sendSuccess(res, item, 'Product created', 201);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.updateProduct(param(req, 'id'), req.body);
  sendSuccess(res, item, 'Product updated');
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  await catalog.deleteProduct(param(req, 'id'));
  sendSuccess(res, null, 'Product deleted');
});

export const updateInventory = asyncHandler(async (req: Request, res: Response) => {
  const item = await catalog.updateInventory(param(req, 'id'), req.body.stock);
  sendSuccess(res, item, 'Inventory updated');
});

export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }
  const result = await uploadProductImage(req.file.buffer, req.file.mimetype);
  sendSuccess(res, result, 'Uploaded', 201);
});

export const compareProducts = asyncHandler(async (req: Request, res: Response) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .filter(Boolean)
    .slice(0, 4);
  const items = await catalog.getProductsByIds(ids);
  sendSuccess(res, items);
});
