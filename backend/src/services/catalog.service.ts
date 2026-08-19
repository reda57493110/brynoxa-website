import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { slugify, uniqueSlug } from '../utils/slugify';

export async function listCategories(activeOnly = true) {
  const filter: Record<string, unknown> = {
    slug: { $nin: ['office', 'networking'] },
  };
  if (activeOnly) filter.isActive = true;
  return Category.find(filter).sort({ sortOrder: 1, name: 1 }).populate('parent', 'name slug');
}

export async function getCategoryBySlug(slug: string) {
  if (slug === 'office' || slug === 'networking') throw new ApiError(404, 'Category not found');
  const category = await Category.findOne({ slug, isActive: true });
  if (!category) throw new ApiError(404, 'Category not found');
  return category;
}

export async function createCategory(data: {
  name: string;
  description?: string;
  image?: string;
  parent?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}) {
  let slug = slugify(data.name);
  const exists = await Category.findOne({ slug });
  if (exists) slug = uniqueSlug(data.name, Date.now().toString(36));

  return Category.create({
    ...data,
    slug,
    parent: data.parent || null,
  });
}

export async function updateCategory(id: string, data: Partial<{
  name: string;
  description: string;
  image: string;
  parent: string | null;
  isActive: boolean;
  sortOrder: number;
}>) {
  const category = await Category.findById(id);
  if (!category) throw new ApiError(404, 'Category not found');
  if (data.name && data.name !== category.name) {
    category.slug = slugify(data.name);
    category.name = data.name;
  }
  if (data.description !== undefined) category.description = data.description;
  if (data.image !== undefined) category.image = data.image;
  if (data.parent !== undefined) category.parent = data.parent as never;
  if (data.isActive !== undefined) category.isActive = data.isActive;
  if (data.sortOrder !== undefined) category.sortOrder = data.sortOrder;
  await category.save();
  return category;
}

export async function deleteCategory(id: string) {
  const inUse = await Product.exists({ category: id });
  if (inUse) throw new ApiError(400, 'Category has products; reassign them first');
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, 'Category not found');
  return category;
}

export async function listBrands(activeOnly = true) {
  const filter = activeOnly ? { isActive: true } : {};
  return Brand.find(filter).sort({ name: 1 });
}

export async function createBrand(data: { name: string; logo?: string; isActive?: boolean }) {
  let slug = slugify(data.name);
  if (await Brand.findOne({ slug })) slug = uniqueSlug(data.name, Date.now().toString(36));
  return Brand.create({ ...data, slug });
}

export async function updateBrand(
  id: string,
  data: Partial<{ name: string; logo: string; isActive: boolean }>
) {
  const brand = await Brand.findById(id);
  if (!brand) throw new ApiError(404, 'Brand not found');
  if (data.name && data.name !== brand.name) {
    brand.name = data.name;
    brand.slug = slugify(data.name);
  }
  if (data.logo !== undefined) brand.logo = data.logo;
  if (data.isActive !== undefined) brand.isActive = data.isActive;
  await brand.save();
  return brand;
}

export async function deleteBrand(id: string) {
  const inUse = await Product.exists({ brand: id });
  if (inUse) throw new ApiError(400, 'Brand has products; reassign them first');
  const brand = await Brand.findByIdAndDelete(id);
  if (!brand) throw new ApiError(404, 'Brand not found');
  return brand;
}

type ProductQuery = {
  page: number;
  limit: number;
  sort?: string;
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  featured?: boolean;
  inStock?: boolean;
  isActive?: boolean;
  admin?: boolean;
};

export async function listProducts(query: ProductQuery) {
  const filter: Record<string, unknown> = {};
  if (!query.admin) filter.isActive = true;
  else if (query.isActive !== undefined) filter.isActive = query.isActive;

  if (query.q?.trim()) {
    const rx = new RegExp(query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { tags: rx }];
  }
  if (query.category) filter.category = query.category;
  if (query.brand) filter.brand = query.brand;
  if (query.featured) filter.isFeatured = true;
  if (query.inStock) filter.stock = { $gt: 0 };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined) (filter.price as Record<string, number>).$gte = query.minPrice;
    if (query.maxPrice !== undefined) (filter.price as Record<string, number>).$lte = query.maxPrice;
  }

  let sort: Record<string, 1 | -1> = { createdAt: -1 };
  switch (query.sort) {
    case 'price_asc':
      sort = { price: 1 };
      break;
    case 'price_desc':
      sort = { price: -1 };
      break;
    case 'rating':
      sort = { averageRating: -1 };
      break;
    case 'popular':
      sort = { soldCount: -1 };
      break;
    case 'name':
      sort = { name: 1 };
      break;
    default:
      sort = { createdAt: -1 };
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(query.limit)
      .populate('category', 'name slug')
      .populate('brand', 'name slug logo'),
    Product.countDocuments(filter),
  ]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, isActive: true })
    .populate('category', 'name slug')
    .populate('brand', 'name slug logo');
  if (!product) throw new ApiError(404, 'Product not found');
  return product;
}

export async function getProductById(id: string) {
  const product = await Product.findById(id)
    .populate('category', 'name slug')
    .populate('brand', 'name slug logo');
  if (!product) throw new ApiError(404, 'Product not found');
  return product;
}

export async function createProduct(data: Record<string, unknown>) {
  const name = data.name as string;
  let slug = slugify(name);
  if (await Product.findOne({ slug })) slug = uniqueSlug(name, Date.now().toString(36));

  const sku = String(data.sku).toUpperCase();
  if (await Product.findOne({ sku })) throw new ApiError(409, 'SKU already exists');

  return Product.create({ ...data, slug, sku });
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found');

  if (data.name && data.name !== product.name) {
    product.name = data.name as string;
    product.slug = slugify(data.name as string);
  }
  const fields = [
    'description',
    'shortDescription',
    'category',
    'brand',
    'images',
    'price',
    'compareAtPrice',
    'stock',
    'lowStockThreshold',
    'specs',
    'tags',
    'isFeatured',
    'isActive',
  ] as const;

  for (const key of fields) {
    if (data[key] !== undefined) {
      (product as unknown as Record<string, unknown>)[key] = data[key];
    }
  }
  if (data.sku) {
    const sku = String(data.sku).toUpperCase();
    const clash = await Product.findOne({ sku, _id: { $ne: id } });
    if (clash) throw new ApiError(409, 'SKU already exists');
    product.sku = sku;
  }

  await product.save();
  return product.populate(['category', 'brand']);
}

export async function deleteProduct(id: string) {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new ApiError(404, 'Product not found');
  return product;
}

export async function updateInventory(id: string, stock: number) {
  const product = await Product.findByIdAndUpdate(id, { stock }, { new: true });
  if (!product) throw new ApiError(404, 'Product not found');
  return product;
}

export async function getProductsByIds(ids: string[]) {
  return Product.find({ _id: { $in: ids }, isActive: true })
    .populate('category', 'name slug')
    .populate('brand', 'name slug');
}
