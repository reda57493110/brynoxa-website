import { Coupon } from '../models/Coupon';
import { ApiError } from '../utils/ApiError';

type ProductPrice = { product: string; price: number };

/** A special-price coupon needs at least one product, each once. */
function cleanProductPrices(type: string, list?: ProductPrice[]) {
  if (type !== 'price') return [];
  const seen = new Set<string>();
  const out = (list || []).filter((p) => !seen.has(p.product) && Boolean(seen.add(p.product)));
  if (!out.length) throw new ApiError(400, 'Choose at least one product and its special price');
  return out;
}

export async function listCoupons() {
  return Coupon.find().sort({ createdAt: -1 }).populate('productPrices.product', 'name price');
}

export async function createCoupon(data: {
  code: string;
  type: 'percent' | 'fixed' | 'price';
  value: number;
  productPrices?: ProductPrice[];
  minOrder?: number;
  maxUses?: number;
  perCustomerLimit?: number;
  startsAt?: string;
  expiresAt?: string;
  isActive?: boolean;
}) {
  const exists = await Coupon.findOne({ code: data.code.toUpperCase() });
  if (exists) throw new ApiError(409, 'Coupon code already exists');
  return Coupon.create({
    ...data,
    code: data.code.toUpperCase(),
    value: data.type === 'price' ? 0 : data.value,
    productPrices: cleanProductPrices(data.type, data.productPrices),
    startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
  });
}

export async function updateCoupon(id: string, data: Partial<{
  code: string;
  type: 'percent' | 'fixed' | 'price';
  value: number;
  productPrices: ProductPrice[];
  minOrder: number;
  maxUses: number;
  perCustomerLimit: number;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}>) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  if (data.code) coupon.code = data.code.toUpperCase();
  if (data.type) coupon.type = data.type;
  if (data.value !== undefined) coupon.value = data.value;
  if (data.type !== undefined || data.productPrices !== undefined) {
    coupon.productPrices = cleanProductPrices(coupon.type, data.productPrices ?? coupon.productPrices.map((p) => ({ product: String(p.product), price: p.price }))) as never;
  }
  if (data.minOrder !== undefined) coupon.minOrder = data.minOrder;
  if (data.maxUses !== undefined) coupon.maxUses = data.maxUses;
  if (data.perCustomerLimit !== undefined) coupon.perCustomerLimit = data.perCustomerLimit;
  if (data.startsAt !== undefined) coupon.startsAt = data.startsAt ? new Date(data.startsAt) : undefined;
  if (data.expiresAt !== undefined) coupon.expiresAt = data.expiresAt ? new Date(data.expiresAt) : undefined;
  if (data.isActive !== undefined) coupon.isActive = data.isActive;
  await coupon.save();
  return coupon;
}

export async function deleteCoupon(id: string) {
  const coupon = await Coupon.findByIdAndDelete(id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  return coupon;
}
