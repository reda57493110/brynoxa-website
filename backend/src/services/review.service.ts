import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { Review } from '../models/Review';
import { Product } from '../models/Product';
import { Order } from '../models/Order';
import { ApiError } from '../utils/ApiError';

async function recalcProductRating(productId: string) {
  const agg = await Review.aggregate([
    { $match: { product: new Types.ObjectId(productId), isApproved: true } },
    {
      $group: {
        _id: '$product',
        averageRating: { $avg: '$rating' },
        reviewCount: { $sum: 1 },
      },
    },
  ]);

  const result = agg[0];
  await Product.findByIdAndUpdate(productId, {
    averageRating: result ? Math.round(result.averageRating * 10) / 10 : 0,
    reviewCount: result?.reviewCount || 0,
  });
}

export async function createReview(input: {
  userId: string;
  productId: string;
  rating: number;
  title: string;
  comment: string;
}) {
  const product = await Product.findById(input.productId);
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found');

  const purchased = await Order.exists({
    user: input.userId,
    'items.product': input.productId,
    orderStatus: { $in: ['delivered', 'shipped', 'processing', 'confirmed'] },
  });

  const existing = await Review.findOne({ product: input.productId, user: input.userId });
  if (existing) throw new ApiError(409, 'You already reviewed this product');

  const review = await Review.create({
    product: input.productId,
    user: input.userId,
    rating: input.rating,
    title: input.title,
    comment: input.comment,
    isApproved: true,
  });

  await recalcProductRating(input.productId);
  return { review, verifiedPurchase: Boolean(purchased) };
}

export async function listProductReviews(productId: string, page = 1, limit = 10) {
  const filter = { product: productId, isApproved: true };
  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name avatar'),
    Review.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function listUserReviews(userId: string) {
  return Review.find({ user: userId }).sort({ createdAt: -1 }).populate('product', 'name slug images');
}

export async function listAllReviews(page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    Review.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .populate('product', 'name slug'),
    Review.countDocuments(),
  ]);
  return { items, total, page, limit };
}

export async function moderateReview(id: string, isApproved: boolean) {
  const review = await Review.findByIdAndUpdate(id, { isApproved }, { new: true });
  if (!review) throw new ApiError(404, 'Review not found');
  await recalcProductRating(review.product.toString());
  return review;
}

export async function deleteReview(id: string) {
  const review = await Review.findByIdAndDelete(id);
  if (!review) throw new ApiError(404, 'Review not found');
  await recalcProductRating(review.product.toString());
  return review;
}

void mongoose;
