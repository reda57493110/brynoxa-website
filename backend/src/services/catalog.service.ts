import mongoose from 'mongoose';
import { Category } from '../models/Category';
import { Brand } from '../models/Brand';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { sanitizeDepositRule } from '../utils/deposit';
import { slugify, uniqueSlug } from '../utils/slugify';
import { deleteAbandonedUploads, deleteUnusedImages } from './upload.service';

function looksLikeObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value) && String(new mongoose.Types.ObjectId(value)) === value;
}

async function resolveCategoryId(category: string) {
  if (looksLikeObjectId(category)) return category;
  const doc = await Category.findOne({ slug: category }).select('_id');
  return doc?._id?.toString() || null;
}

async function resolveBrandId(brand: string) {
  if (looksLikeObjectId(brand)) return brand;
  const doc = await Brand.findOne({ slug: brand }).select('_id');
  return doc?._id?.toString() || null;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Storefront-only: products must belong to an active category. */
const ACTIVE_CATEGORY_TTL_MS = 60_000;
let activeCategoryCache: { at: number; ids: mongoose.Types.ObjectId[] } = {
  at: 0,
  ids: [],
};

async function activeCategoryObjectIds() {
  const now = Date.now();
  if (now - activeCategoryCache.at < ACTIVE_CATEGORY_TTL_MS && activeCategoryCache.ids.length) {
    return activeCategoryCache.ids;
  }
  const cats = await Category.find({
    isActive: true,
    slug: { $nin: ['office', 'networking'] },
  })
    .select('_id')
    .lean();
  activeCategoryCache = {
    at: now,
    ids: cats.map((c) => c._id as mongoose.Types.ObjectId),
  };
  return activeCategoryCache.ids;
}

/** Call after category create/update/delete so storefront filters stay correct. */
export function invalidateActiveCategoryCache() {
  activeCategoryCache = { at: 0, ids: [] };
}

function categoryIsActive(category: unknown): boolean {
  if (!category || typeof category !== 'object') return false;
  const doc = category as { isActive?: boolean; slug?: string };
  if (doc.slug === 'office' || doc.slug === 'networking') return false;
  // Missing isActive on lean/partial populate → assume active only if not explicitly false
  return doc.isActive !== false;
}

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

  const created = await Category.create({
    ...data,
    slug,
    parent: data.parent || null,
  });
  invalidateActiveCategoryCache();
  return created;
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
  invalidateActiveCategoryCache();
  return category;
}

export async function deleteCategory(id: string) {
  const inUse = await Product.exists({ category: id });
  if (inUse) throw new ApiError(400, 'Category has products; reassign them first');
  const category = await Category.findByIdAndDelete(id);
  if (!category) throw new ApiError(404, 'Category not found');
  invalidateActiveCategoryCache();
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
  carousel?: boolean;
  inStock?: boolean;
  isActive?: boolean;
  admin?: boolean;
};

export async function listProducts(query: ProductQuery) {
  const filter: Record<string, unknown> = {};
  if (!query.admin) filter.isActive = true;
  else if (query.isActive !== undefined) filter.isActive = query.isActive;

  const q = query.q?.trim() || '';
  let useTextScore = false;
  if (q) {
    // SKU / short codes: use indexed prefix match. Longer phrases: Mongo text index.
    const looksLikeSku = /^[a-z0-9][a-z0-9\-_]{1,31}$/i.test(q) && !/\s/.test(q);
    if (looksLikeSku) {
      const rx = new RegExp(`^${escapeRegex(q)}`, 'i');
      filter.$or = [{ sku: rx }, { name: rx }];
    } else {
      filter.$text = { $search: q };
      useTextScore = true;
    }
  }
  if (query.category) {
    const categoryId = await resolveCategoryId(query.category);
    if (!categoryId) {
      return { items: [], total: 0, page: query.page, limit: query.limit };
    }
    // Hidden categories are not browsable on the storefront.
    if (!query.admin) {
      const active = await Category.findOne({
        _id: categoryId,
        isActive: true,
        slug: { $nin: ['office', 'networking'] },
      })
        .select('_id')
        .lean();
      if (!active) {
        return { items: [], total: 0, page: query.page, limit: query.limit };
      }
    }
    filter.category = categoryId;
  } else if (!query.admin) {
    const activeIds = await activeCategoryObjectIds();
    if (!activeIds.length) {
      return { items: [], total: 0, page: query.page, limit: query.limit };
    }
    filter.category = { $in: activeIds };
  }
  if (query.brand) {
    const brandId = await resolveBrandId(query.brand);
    if (!brandId) {
      return { items: [], total: 0, page: query.page, limit: query.limit };
    }
    filter.brand = brandId;
  }
  if (query.featured) filter.isFeatured = true;
  if (query.carousel) filter.isCarousel = true;
  if (query.inStock) filter.stock = { $gt: 0 };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined) (filter.price as Record<string, number>).$gte = query.minPrice;
    if (query.maxPrice !== undefined) (filter.price as Record<string, number>).$lte = query.maxPrice;
  }

  let sort: Record<string, 1 | -1 | { $meta: string }> = { createdAt: -1 };
  if (query.featured) {
    sort = { featuredAt: -1, createdAt: -1 };
  } else if (query.carousel) {
    sort = { carouselAt: -1, createdAt: -1 };
  } else {
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
        sort = useTextScore
          ? { score: { $meta: 'textScore' }, createdAt: -1 }
          : { createdAt: -1 };
    }
  }

  const skip = (query.page - 1) * query.limit;
  const listQuery = Product.find(filter)
    .skip(skip)
    .limit(query.limit)
    .populate('category', 'name slug isActive')
    .populate('brand', 'name slug logo')
    .lean();

  if (useTextScore && !query.sort) {
    listQuery.select({ score: { $meta: 'textScore' } });
    listQuery.sort({ score: { $meta: 'textScore' }, createdAt: -1 } as never);
  } else {
    listQuery.sort(sort as never);
  }

  const [items, total] = await Promise.all([listQuery, Product.countDocuments(filter)]);

  return { items, total, page: query.page, limit: query.limit };
}

export async function getProductBySlug(slug: string) {
  const product = await Product.findOne({ slug, isActive: true })
    .populate('category', 'name slug isActive')
    .populate('brand', 'name slug logo');
  if (!product) throw new ApiError(404, 'Product not found');
  if (!categoryIsActive(product.category)) {
    throw new ApiError(404, 'Product not found');
  }
  return product;
}

/** Valid, unique product ids (never the product itself), max 12, in the given order. */
function sanitizeRecommended(input: unknown, selfId?: string): mongoose.Types.ObjectId[] {
  if (!Array.isArray(input)) return [];
  const ids = [...new Set(input.map((v) => String(v)))].filter(
    (id) => looksLikeObjectId(id) && id !== selfId
  );
  return ids.slice(0, 12).map((id) => new mongoose.Types.ObjectId(id));
}

/** A valid cost price, or undefined to leave it unset (empty / null / negative). */
function costPriceOf(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined;
}

export async function getProductById(id: string) {
  const product = await Product.findById(id)
    .select('+costPrice')
    .populate('category', 'name slug isActive')
    .populate('brand', 'name slug logo')
    .populate('recommended', 'name sku slug images price stock isActive');
  if (!product) throw new ApiError(404, 'Product not found');
  return product;
}

export async function createProduct(data: Record<string, unknown>) {
  const name = data.name as string;
  let slug = slugify(name);
  if (await Product.findOne({ slug })) slug = uniqueSlug(name, Date.now().toString(36));

  const sku = String(data.sku).toUpperCase();
  if (await Product.findOne({ sku })) throw new ApiError(409, 'SKU already exists');

  const isFeatured = Boolean(data.isFeatured);
  const isCarousel = Boolean(data.isCarousel);
  const product = await Product.create({
    ...data,
    deposit: sanitizeDepositRule(data.deposit) ?? undefined,
    recommended: sanitizeRecommended(data.recommended),
    costPrice: costPriceOf(data.costPrice),
    recommendedOnly: Boolean(data.recommendedOnly),
    slug,
    sku,
    isFeatured,
    featuredAt: isFeatured ? new Date() : null,
    isCarousel,
    carouselAt: isCarousel ? new Date() : null,
  });
  await deleteAbandonedUploads();
  return product;
}

export async function updateProduct(id: string, data: Record<string, unknown>) {
  const product = await Product.findById(id);
  if (!product) throw new ApiError(404, 'Product not found');
  const previousImages = product.images.map(({ url, publicId }) => ({ url, publicId }));

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
    'isActive',
  ] as const;

  for (const key of fields) {
    if (data[key] !== undefined) {
      (product as unknown as Record<string, unknown>)[key] = data[key];
    }
  }

  if (data.deposit !== undefined) {
    const deposit = sanitizeDepositRule(data.deposit);
    if (deposit) product.deposit = deposit;
    else product.set('deposit', undefined);
  }

  if (data.costPrice !== undefined) {
    const cost = costPriceOf(data.costPrice);
    if (cost === undefined) product.set('costPrice', undefined);
    else product.costPrice = cost;
  }

  if (data.recommended !== undefined) {
    product.recommended = sanitizeRecommended(data.recommended, String(product._id));
  }
  if (data.recommendedOnly !== undefined) {
    product.recommendedOnly = Boolean(data.recommendedOnly);
  }

  if (data.isFeatured !== undefined) {
    const next = Boolean(data.isFeatured);
    if (next) product.featuredAt = new Date();
    else product.featuredAt = null;
    product.isFeatured = next;
  }

  if (data.isCarousel !== undefined) {
    const next = Boolean(data.isCarousel);
    if (next) product.carouselAt = new Date();
    else product.carouselAt = null;
    product.isCarousel = next;
  }

  if (data.sku) {
    const sku = String(data.sku).toUpperCase();
    const clash = await Product.findOne({ sku, _id: { $ne: id } });
    if (clash) throw new ApiError(409, 'SKU already exists');
    product.sku = sku;
  }

  await product.save();

  const currentUrls = new Set(product.images.map((img) => img.url));
  await deleteUnusedImages(previousImages.filter((img) => !currentUrls.has(img.url)));
  await deleteAbandonedUploads();

  return product.populate(['category', 'brand']);
}

export async function deleteProduct(id: string) {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new ApiError(404, 'Product not found');
  await deleteUnusedImages(product.images);
  return product;
}

export async function updateInventory(
  id: string,
  stock: number,
  lowStockThreshold?: number
) {
  const update: { stock: number; lowStockThreshold?: number } = { stock };
  if (lowStockThreshold !== undefined) update.lowStockThreshold = lowStockThreshold;
  const product = await Product.findByIdAndUpdate(id, update, { new: true });
  if (!product) throw new ApiError(404, 'Product not found');
  return product;
}

export async function getProductsByIds(ids: string[]) {
  const activeIds = await activeCategoryObjectIds();
  if (!activeIds.length) return [];
  return Product.find({
    _id: { $in: ids },
    isActive: true,
    category: { $in: activeIds },
  })
    .populate('category', 'name slug isActive')
    .populate('brand', 'name slug');
}
