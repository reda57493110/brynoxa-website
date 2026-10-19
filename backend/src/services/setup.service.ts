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
 *                           (true with no picks = show nothing)
 *  - `recommendedHidden`    automatic suggestions hidden for this product
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
  const products = await Product.find({
    $or: [{ 'recommended.0': { $exists: true } }, { 'recommendedHidden.0': { $exists: true } }, { recommendedOnly: true }],
  })
    .select('name sku slug images isActive category recommended recommendedDisabled recommendedHidden recommendedOnly updatedAt')
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
      hidden: (p.recommendedHidden || []).length,
      off: Boolean(p.recommendedOnly) && !total,
      updatedAt: p.updatedAt,
    };
  });
}

/** Populated product refs (deleted products are skipped) in the compact shape the admin page uses. */
function populated(list: unknown) {
  return ((list || []) as unknown[])
    .filter((r): r is Record<string, unknown> & { _id: unknown } => Boolean(r) && typeof r === 'object' && '_id' in (r as object))
    .map((r) => ({
      _id: String(r._id),
      name: String(r.name || ''),
      sku: String(r.sku || ''),
      slug: String(r.slug || ''),
      image: primaryImage(r.images as { url: string; isPrimary?: boolean }[]),
      price: Number(r.price || 0),
      stock: Number(r.stock || 0),
      isActive: Boolean(r.isActive),
      category: categoryName(r.category),
    }));
}

/** One main product: its picks in order (with real product data) and what the automatic system would show. */
export async function getSetup(productId: string) {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, 'Product not found');
  const product = await Product.findById(productId)
    .select('name sku slug images price stock isActive category specTemplate specs tags recommended recommendedDisabled recommendedOnly recommendedHidden')
    .populate('category', 'name slug')
    .populate({ path: 'recommended', select: ITEM_FIELDS, populate: { path: 'category', select: 'name' } })
    .populate({ path: 'recommendedHidden', select: ITEM_FIELDS, populate: { path: 'category', select: 'name' } })
    .lean();
  if (!product) throw new ApiError(404, 'Product not found');

  const disabled = new Set((product.recommendedDisabled || []).map(String));
  const items = populated(product.recommended).map((product) => ({ product, enabled: !disabled.has(product._id) }));
  const hidden = populated(product.recommendedHidden);

  const specs = product.specs instanceof Map ? Object.fromEntries(product.specs) : (product.specs as Record<string, string>) || {};
  const automatic = await previewRecommendations({
    productId: String(product._id),
    name: product.name,
    category: product.category && typeof product.category === 'object' ? String((product.category as { _id: unknown })._id) : undefined,
    specTemplate: product.specTemplate,
    tags: product.tags || [],
    specs,
    picks: items.map((i) => i.product._id),
    hidden: hidden.map((h) => h._id),
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
    hidden,
    fillWithAutomatic: !product.recommendedOnly,
    off: Boolean(product.recommendedOnly) && !items.length,
    automatic,
  };
}

/**
 * Save the picks of a main product. Every id must be a real product, listed once, and not the
 * main product itself; otherwise nothing is saved.
 */
export async function saveSetup(
  productId: string,
  input: { items: { productId: string; enabled: boolean }[]; fillWithAutomatic: boolean; hidden?: string[]; off?: boolean }
) {
  if (!mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(404, 'Product not found');
  const product = await Product.findById(productId).select('_id').lean();
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

  const hidden = [...new Set((input.hidden ?? []).map(String))].filter((id) => mongoose.Types.ObjectId.isValid(id) && id !== productId && !seen.has(id)).slice(0, 50);
  const off = Boolean(input.off) && !ids.length;

  // Only the recommendation fields change (no full re-validation of the rest of the product)
  await Product.updateOne(
    { _id: productId },
    {
      $set: {
        recommended: ids.map((id) => new mongoose.Types.ObjectId(id)),
        recommendedDisabled: items.filter((i) => !i.enabled).map((i) => new mongoose.Types.ObjectId(String(i.productId))),
        recommendedHidden: hidden.map((id) => new mongoose.Types.ObjectId(id)),
        // Picks: only them unless "also automatic". No picks: automatic, or nothing when switched off.
        recommendedOnly: off || (ids.length > 0 && !input.fillWithAutomatic),
      },
    }
  );
  return getSetup(productId);
}
