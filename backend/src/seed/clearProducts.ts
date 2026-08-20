import { connectDB } from '../config/db';
import { Product } from '../models/Product';
import { Review } from '../models/Review';
import { Wishlist } from '../models/Wishlist';

async function clearProducts() {
  await connectDB();

  const before = await Product.countDocuments();
  const reviews = await Review.deleteMany({});
  await Wishlist.updateMany({}, { $set: { products: [] } });
  const products = await Product.deleteMany({});

  console.log(
    `Cleared catalog: ${products.deletedCount} products (was ${before}), ${reviews.deletedCount} reviews. Categories/brands kept.`
  );
  process.exit(0);
}

clearProducts().catch((err) => {
  console.error(err);
  process.exit(1);
});
