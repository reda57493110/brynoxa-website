import { connectDB } from '../config/db';
import { Order } from '../models/Order';
import { Notification } from '../models/Notification';

async function clearOrders() {
  await connectDB();

  const before = await Order.countDocuments();
  const orders = await Order.deleteMany({});
  const notifications = await Notification.deleteMany({});

  console.log(
    `Cleared orders: ${orders.deletedCount} (was ${before}), ${notifications.deletedCount} notifications.`
  );
  process.exit(0);
}

clearOrders().catch((err) => {
  console.error(err);
  process.exit(1);
});
