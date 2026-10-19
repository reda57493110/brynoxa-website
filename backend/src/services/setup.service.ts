import mongoose from 'mongoose';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { previewRecommendations } from './recommendation.service';

/**
 * Admin → Complete your setup: the hand-picked products shown next to a main product.
 *
 * Stored on the main product itself (no copies of names, photos or prices):
 *  - `recommended`          the picks, in display order
 *  - `recommendedDisabled`  picks kept in the list but switched off
 *  - `recommendedOnly`      true = show only the picks; false = automatic suggestions fill the rest
 * A product without picks keeps the automatic (category-based) suggestions.
 */

export const MAX_SETUP_ITEMS = 12;
const ITEM_FIELDS = 'name sku slug images price compareAtPrice stock isActive category';

function primaryImage(images?: { url: string; isPrimary?: boolean }[]) {
  return images?.find((i) => i.isPrimary)?.url || images?.[0]?.url || '';
}

function categoryName(category: unknown) {
  return category && typeof category === 'object' && 'name' in category ? String((category as { name?: string }).name || '') : '';
}

/** Products that have hand-picked recommendations, most recently changed first. */
export async function listConfiguredSetups() {
  const products = await Product.find({ 'recommended.0': { $exists: true } })
    .select('name sku slug images isActive category recommended recommendedDisabled recommendedOnly updatedAt')
    .populate('category', 'name')
    .sort({ updatedAt: -1 })
    .limit(300)
    .lean();
  return products.map((p) => {
    const disabled = new Set((p.recommendedDisabled || []).map(String));
    const total = (p.recommended || []).length;
    return {
      _id: String(p._id),
      name: p.name,
      sku: p.sku,
      slug: p.slug,
      image: primaryImage(p.images),
      category: categoryName(p.category),
      isActive: p.isActive,
      total,
      enabled: (p.recommended || []).filter((id) => !disabled.has(String(id))).length,
      fillWithAutomatic: !p.recommendedOnly,
      updatedAt: p.updatedAt,
    };
  });
}

/** One main product: its picks in order (with real product data) and what the automatic system would show. */
export async function getSetup(productId: string) {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, 'Product not found');
  const product = await Product.findById(productId)
    .select('name sku slug images price stock isActive category specTemplate specs tags recommended recommendedDisabled recommendedOnly')
    .populate('category', 'name slug')
    .populate({ path: 'recommended', select: ITEM_FIELDS, populate: { path: 'category', select: 'name' } })
    .lean();
  if (!product) throw new ApiError(404, 'Product not found');

  const disabled = new Set((product.recommendedDisabled || []).map(String));
  const items = ((product.recommended || []) as unknown[])
    .filter((r): r is Record<string, unknown> & { _id: unknown } => Boolean(r) && typeof r === 'object' && '_id' in (r as object))
    .map((r) => ({
      product: {
        _id: String(r._id),
        name: String(r.name || ''),
        sku: String(r.sku || ''),
        slug: String(r.slug || ''),
        image: primaryImage(r.images as { url: string; isPrimary?: boolean }[]),
        price: Number(r.price || 0),
        stock: Number(r.stock || 0),
        isActive: Boolean(r.isActive),
        category: categoryName(r.category),
      },
      enabled: !disabled.has(String(r._id)),
    }));

  const specs = product.specs instanceof Map ? Object.fromEntries(product.specs) : (product.specs as Record<string, string>) || {};
  const automatic = await previewRecommendations({
    productId: String(product._id),
    name: product.name,
    category: product.category && typeof product.category === 'object' ? String((product.category as { _id: unknown })._id) : undefined,
    specTemplate: product.specTemplate,
    tags: product.tags || [],
    specs,
    picks: items.map((i) => i.product._id),
  });

  return {
    product: {
      _id: String(product._id),
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      image: primaryImage(product.images),
      price: product.price,
      stock: product.stock,
      isActive: product.isActive,
      category: categoryName(product.category),
    },
    items,
    fillWithAutomatic: !product.recommendedOnly,
    automatic,
  };
}

/**
 * Save the picks of a main product. Every id must be a real product, listed once, and not the
 * main product itself; otherwise nothing is saved.
 */
export async function saveSetup(
  productId: string,
  input: { items: { productId: string; enabled: boolean }[]; fillWithAutomatic: boolean }
) {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, 'Product not found');
  const product = await Product.findById(productId);
  if (!product) throw new ApiError(404, 'Product not found');

  const items = input.items ?? [];
  if (items.length > MAX_SETUP_ITEMS) throw new ApiError(400, `Up to ${MAX_SETUP_ITEMS} products per main product`);
  const seen = new Set<string>();
  for (const item of items) {
    const id = String(item.productId);
    if (!mongoose.Types.ObjectId.isValid(id)) throw new ApiError(400, 'Invalid product reference');
    if (id === productId) throw new ApiError(400, 'A product cannot recommend itself');
    if (seen.has(id)) throw new ApiError(400, 'The same product is listed twice');
    seen.add(id);
  }
  const ids = [...seen];
  if (ids.length) {
    const found = await Product.countDocuments({ _id: { $in: ids } });
    if (found !== ids.length) throw new ApiError(400, 'Some products no longer exist — reload the page');
  }

  product.recommended = ids.map((id) => new mongoose.Types.ObjectId(id));
  product.recommendedDisabled = items.filter((i) => !i.enabled).map((i) => new mongoose.Types.ObjectId(String(i.productId)));
  // With picks: only the picks unless "fill with automatic" is on. Without picks: automatic again.
  product.recommendedOnly = ids.length > 0 && !input.fillWithAutomatic;
  await product.save();
  return getSetup(productId);
}
