import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Wishlist } from '../models/Wishlist';
import { Notification } from '../models/Notification';
import { Review } from '../models/Review';

async function clearCustomers() {
  await connectDB();

  const customers = await User.find({ role: 'customer' }).select('_id');
  const ids = customers.map((c) => c._id);
  const before = ids.length;

  if (ids.length) {
    await Promise.all([
      Wishlist.deleteMany({ user: { $in: ids } }),
      Notification.deleteMany({ user: { $in: ids } }),
      Review.deleteMany({ user: { $in: ids } }),
      User.deleteMany({ _id: { $in: ids }, role: 'customer' }),
    ]);
  }

  console.log(`Cleared customers: ${before}. Admin account kept.`);
  process.exit(0);
}

clearCustomers().catch((err) => {
  console.error(err);
  process.exit(1);
});
