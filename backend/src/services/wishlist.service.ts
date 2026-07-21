import { Wishlist } from '../models/Wishlist';
import { Product } from '../models/Product';
import { ApiError } from '../utils/ApiError';

async function getOrCreate(userId: string) {
  let wishlist = await Wishlist.findOne({ user: userId });
  if (!wishlist) wishlist = await Wishlist.create({ user: userId, products: [] });
  return wishlist;
}

export async function getWishlist(userId: string) {
  const wishlist = await getOrCreate(userId);
  await wishlist.populate({
    path: 'products',
    populate: [
      { path: 'category', select: 'name slug' },
      { path: 'brand', select: 'name slug' },
    ],
  });
  return wishlist;
}

export async function addToWishlist(userId: string, productId: string) {
  const product = await Product.findById(productId);
  if (!product || !product.isActive) throw new ApiError(404, 'Product not found');

  const wishlist = await getOrCreate(userId);
  const id = product._id.toString();
  if (!wishlist.products.some((p) => p.toString() === id)) {
    wishlist.products.push(product._id);
    await wishlist.save();
  }
  return getWishlist(userId);
}

export async function removeFromWishlist(userId: string, productId: string) {
  const wishlist = await getOrCreate(userId);
  wishlist.products = wishlist.products.filter((p) => p.toString() !== productId);
  await wishlist.save();
  return getWishlist(userId);
}

export async function syncWishlist(userId: string, productIds: string[]) {
  const valid = await Product.find({ _id: { $in: productIds }, isActive: true }).select('_id');
  const wishlist = await getOrCreate(userId);
  const existing = new Set(wishlist.products.map((p) => p.toString()));
  for (const p of valid) existing.add(p._id.toString());
  wishlist.products = [...existing].map((id) => id as never);
  await wishlist.save();
  return getWishlist(userId);
}
