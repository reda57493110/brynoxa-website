import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';
import { sanitizeSpecs } from '../utils/specs';

/**
 * Product variants: the same model sold with different options (8 GB / 16 GB RAM, 256 / 512 GB…).
 * Each variant is its own product (own SKU, price, stock, inventory), linked by `variantGroup`.
 * The shop lists one product per group (`variantListed`) and the product page switches between
 * them using the specs named in `variantAttributes`.
 */

const VARIANT_FIELDS = 'name slug sku price compareAtPrice stock specs specTemplate variantLabel images isActive createdAt';
const MAX_ATTRIBUTES = 4;
const MAX_GROUP = 30;

export function sanitizeVariantAttributes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.map((v) => String(v).trim()))]
    .filter((k) => /^[a-z0-9_]{1,40}$/.test(k))
    .slice(0, MAX_ATTRIBUTES);
}

export function sanitizeVariantLabel(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return String(value).trim().slice(0, 120);
}

type LeanVariant = {
  _id: unknown;
  name: string;
  slug: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  specs?: Record<string, string>;
  specTemplate?: string;
  variantLabel?: string;
  isActive: boolean;
  images?: { url: string; isPrimary?: boolean }[];
};

/** The products of a group (this one included), oldest first. Shop: active ones only. */
export async function variantsOf(product: { variantGroup?: string | null }, activeOnly: boolean) {
  if (!product.variantGroup) return [];
  const filter: Record<string, unknown> = { variantGroup: product.variantGroup };
  if (activeOnly) filter.isActive = true;
  const list = await Product.find(filter).select(VARIANT_FIELDS).sort({ createdAt: 1 }).limit(MAX_GROUP).lean<LeanVariant[]>();
  return list.map((p) => ({
    _id: String(p._id),
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    stock: p.stock,
    specs: p.specs || {},
    specTemplate: p.specTemplate,
    variantLabel: p.variantLabel,
    isActive: p.isActive,
    image: (p.images?.find((i) => i.isPrimary) || p.images?.[0])?.url,
  }));
}

/**
 * Keep a group consistent: one product listed in the shop (the oldest active one), and a group of
 * one is dissolved. Call after anything that adds, removes, deletes or (de)activates a member.
 */
export async function syncVariantGroup(groupId?: string | null) {
  if (!groupId) return;
  const members = await Product.find({ variantGroup: groupId })
    .select('isActive createdAt')
    .sort({ createdAt: 1 })
    .lean<{ _id: unknown; isActive: boolean }[]>();
  if (members.length <= 1) {
    await Product.updateMany(
      { variantGroup: groupId },
      { $unset: { variantGroup: 1, variantAttributes: 1, variantListed: 1, variantLabel: 1 } }
    );
    return;
  }
  const listed = members.find((m) => m.isActive) ?? members[0];
  await Product.updateMany({ variantGroup: groupId, _id: { $ne: listed._id } }, { $set: { variantListed: false } });
  await Product.updateOne({ _id: listed._id }, { $set: { variantListed: true } });
}

async function freeSku(base: string) {
  for (let i = 2; i < 100; i++) {
    const sku = `${base}-V${i}`;
    if (!(await Product.exists({ sku }))) return sku;
  }
  return `${base}-V${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Start or extend a group with a new version of this product: a copy with its own option values
 * (e.g. { ram_gb: "16", storage: "512 GB" }), price, SKU and opening stock (recorded in the ledger).
 */
export async function createVariant(
  sourceId: string,
  input: { attributes?: unknown; specs?: unknown; price?: unknown; stock?: unknown; sku?: unknown; isActive?: unknown }
) {
  // Loaded here: catalog.service imports this module too
  const { createProduct } = await import('./catalog.service');
  const src = await Product.findById(sourceId).select('+costPrice');
  if (!src) throw new ApiError(404, 'Product not found');
  const groupId = src.variantGroup || String(src._id);
  if ((await Product.countDocuments({ variantGroup: groupId })) >= MAX_GROUP) {
    throw new ApiError(400, `A product can have up to ${MAX_GROUP} variants`);
  }
  const attributes = sanitizeVariantAttributes(input.attributes) ?? src.variantAttributes ?? [];

  const base = src.toObject({ flattenMaps: true }) as unknown as Record<string, unknown> & {
    specs?: Record<string, string>;
    images?: { url: string; publicId?: string; alt?: string; isPrimary?: boolean }[];
    recommended?: unknown[];
  };
  const price = Number(input.price);
  const hasPrice = input.price !== undefined && input.price !== '' && Number.isFinite(price) && price >= 0;
  const stock = Math.max(0, Math.floor(Number(input.stock) || 0));
  const sku = typeof input.sku === 'string' && input.sku.trim().length >= 2 ? input.sku.trim() : await freeSku(src.sku);
  const finalPrice = hasPrice ? Math.round(price * 100) / 100 : src.price;

  const created = await createProduct({
    name: src.name,
    sku,
    description: src.description,
    shortDescription: src.shortDescription,
    category: String(src.category),
    brand: String(src.brand),
    images: (base.images ?? []).map(({ url, publicId, alt, isPrimary }) => ({ url, publicId, alt, isPrimary })),
    price: finalPrice,
    compareAtPrice: src.compareAtPrice && src.compareAtPrice > finalPrice ? src.compareAtPrice : undefined,
    costPrice: base.costPrice,
    deposit: base.deposit,
    condition: src.condition,
    conditionNote: src.conditionNote,
    specs: { ...(base.specs ?? {}), ...(sanitizeSpecs(input.specs) ?? {}) },
    specTemplate: src.specTemplate,
    tags: src.tags,
    serialTracking: src.serialTracking,
    inventoryLocation: src.inventoryLocation,
    lowStockThreshold: src.lowStockThreshold,
    recommended: (base.recommended ?? []).map(String),
    recommendedOnly: src.recommendedOnly,
    stock,
    isActive: input.isActive === undefined ? false : Boolean(input.isActive),
  });

  if (!src.variantGroup) {
    src.variantGroup = groupId;
    await src.save();
  }
  await Product.updateOne({ _id: created._id }, { $set: { variantGroup: groupId } });
  await Product.updateMany({ variantGroup: groupId }, { $set: { variantAttributes: attributes } });
  await syncVariantGroup(groupId);
  return created;
}

/** Add an existing product (e.g. an older duplicate) to this product's group. Its stock and data stay as they are. */
export async function linkVariant(sourceId: string, otherId: string, input: { attributes?: unknown }) {
  if (sourceId === otherId) throw new ApiError(400, 'Pick another product');
  const [src, other] = await Promise.all([Product.findById(sourceId), Product.findById(otherId)]);
  if (!src || !other) throw new ApiError(404, 'Product not found');
  const groupId = src.variantGroup || String(src._id);
  if (other.variantGroup && other.variantGroup === groupId) return other;
  if ((await Product.countDocuments({ variantGroup: groupId })) >= MAX_GROUP) {
    throw new ApiError(400, `A product can have up to ${MAX_GROUP} variants`);
  }
  const attributes = sanitizeVariantAttributes(input.attributes) ?? src.variantAttributes ?? [];
  const previousGroup = other.variantGroup;
  if (!src.variantGroup) {
    src.variantGroup = groupId;
    await src.save();
  }
  other.variantGroup = groupId;
  await other.save();
  await Product.updateMany({ variantGroup: groupId }, { $set: { variantAttributes: attributes } });
  await syncVariantGroup(groupId);
  if (previousGroup && previousGroup !== groupId) await syncVariantGroup(previousGroup);
  return other;
}

/** Options that differ for the whole group, and each member's short option label ("16 GB · 512 GB"). */
export async function updateVariantGroup(productId: string, input: { attributes?: unknown; labels?: unknown }) {
  const product = await Product.findById(productId).select('variantGroup');
  if (!product?.variantGroup) throw new ApiError(400, 'This product has no variants');
  const groupId = product.variantGroup;
  const attributes = sanitizeVariantAttributes(input.attributes);
  if (attributes) await Product.updateMany({ variantGroup: groupId }, { $set: { variantAttributes: attributes } });
  if (input.labels && typeof input.labels === 'object') {
    for (const [id, label] of Object.entries(input.labels as Record<string, unknown>)) {
      const clean = sanitizeVariantLabel(label);
      if (clean === undefined || !/^[a-f0-9]{24}$/i.test(id)) continue;
      await Product.updateOne({ _id: id, variantGroup: groupId }, { $set: { variantLabel: clean } });
    }
  }
  return variantsOf({ variantGroup: groupId }, false);
}

/** Take this product out of its group; it becomes a normal standalone product again. */
export async function leaveVariantGroup(productId: string) {
  const product = await Product.findById(productId).select('variantGroup');
  if (!product) throw new ApiError(404, 'Product not found');
  const groupId = product.variantGroup;
  if (!groupId) return product;
  await Product.updateOne(
    { _id: product._id },
    { $unset: { variantGroup: 1, variantAttributes: 1, variantListed: 1, variantLabel: 1 } }
  );
  await syncVariantGroup(groupId);
  return product;
}
