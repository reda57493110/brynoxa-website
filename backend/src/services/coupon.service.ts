import { Coupon } from '../models/Coupon';
import { ApiError } from '../utils/ApiError';

export async function listCoupons() {
  return Coupon.find().sort({ createdAt: -1 });
}

export async function createCoupon(data: {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrder?: number;
  maxUses?: number;
  startsAt?: string;
  expiresAt?: string;
  isActive?: boolean;
}) {
  const exists = await Coupon.findOne({ code: data.code.toUpperCase() });
  if (exists) throw new ApiError(409, 'Coupon code already exists');
  return Coupon.create({
    ...data,
    code: data.code.toUpperCase(),
    startsAt: data.startsAt ? new Date(data.startsAt) : undefined,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
  });
}

export async function updateCoupon(id: string, data: Partial<{
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minOrder: number;
  maxUses: number;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}>) {
  const coupon = await Coupon.findById(id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  if (data.code) coupon.code = data.code.toUpperCase();
  if (data.type) coupon.type = data.type;
  if (data.value !== undefined) coupon.value = data.value;
  if (data.minOrder !== undefined) coupon.minOrder = data.minOrder;
  if (data.maxUses !== undefined) coupon.maxUses = data.maxUses;
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
