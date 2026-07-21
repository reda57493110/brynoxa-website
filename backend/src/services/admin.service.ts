import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Review } from '../models/Review';

export async function getDashboardStats() {
  const [
    totalRevenue,
    orderCount,
    pendingOrders,
    customerCount,
    productCount,
    lowStock,
    recentOrders,
    reviewCount,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } },
    ]),
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: 'pending' }),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments(),
    Product.countDocuments({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
    Order.find().sort({ createdAt: -1 }).limit(8).populate('user', 'name email'),
    Review.countDocuments(),
  ]);

  const salesByDay = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        orderStatus: { $ne: 'cancelled' },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$pricing.total' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    revenue: totalRevenue[0]?.total || 0,
    orderCount,
    pendingOrders,
    customerCount,
    productCount,
    lowStock,
    reviewCount,
    recentOrders,
    salesByDay,
  };
}

export async function listCustomers(page = 1, limit = 20) {
  const filter = { role: 'customer' as const };
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function setCustomerActive(id: string, isActive: boolean) {
  const user = await User.findOneAndUpdate(
    { _id: id, role: 'customer' },
    { isActive },
    { new: true }
  );
  return user;
}
