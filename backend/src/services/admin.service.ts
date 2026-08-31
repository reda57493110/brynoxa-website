import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Review } from '../models/Review';
import { ContactMessage, NewsletterSubscriber } from '../models/Contact';
import { ApiError } from '../utils/ApiError';
import { isProd } from '../config/env';
import { sendVerificationEmail } from './auth.service';
import { isStaffRole, STAFF_ROLES, type StaffRole } from '../permissions';

function dayKey(offset: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getDashboardStats() {
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const start30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalRevenue,
    todayRevenue,
    orderCount,
    pendingOrders,
    customerCount,
    productCount,
    lowStock,
    recentOrders,
    reviewCount,
    unreadMessages,
    ordersByStatus,
    salesRaw,
    lowStockProducts,
  ] = await Promise.all([
    Order.aggregate([
      { $match: { orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: startToday }, orderStatus: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$pricing.total' }, orders: { $sum: 1 } } },
    ]),
    Order.countDocuments(),
    Order.countDocuments({ orderStatus: 'pending' }),
    User.countDocuments({ role: 'customer' }),
    Product.countDocuments(),
    Product.countDocuments({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } }),
    Order.find().sort({ createdAt: -1 }).limit(8).populate('user', 'name email'),
    Review.countDocuments(),
    ContactMessage.countDocuments({ status: 'new' }),
    Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: start30 },
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
    ]),
    Product.find({ $expr: { $lte: ['$stock', '$lowStockThreshold'] } })
      .sort({ stock: 1 })
      .limit(8)
      .select('name sku stock slug images lowStockThreshold'),
  ]);

  const salesMap = new Map(salesRaw.map((row) => [row._id as string, row]));
  const salesByDay = Array.from({ length: 14 }, (_, i) => {
    const key = dayKey(i - 13);
    const row = salesMap.get(key);
    return {
      _id: key,
      revenue: row?.revenue || 0,
      orders: row?.orders || 0,
    };
  });

  const statusMap: Record<string, number> = {};
  for (const row of ordersByStatus) {
    statusMap[row._id] = row.count;
  }

  const revenue = totalRevenue[0]?.total || 0;
  const paidOrders = orderCount - (statusMap.cancelled || 0);

  return {
    revenue,
    todayRevenue: todayRevenue[0]?.total || 0,
    todayOrders: todayRevenue[0]?.orders || 0,
    avgOrderValue: paidOrders > 0 ? revenue / paidOrders : 0,
    orderCount,
    pendingOrders,
    customerCount,
    productCount,
    lowStock,
    reviewCount,
    unreadMessages,
    recentOrders,
    salesByDay,
    ordersByStatus: statusMap,
    lowStockProducts,
  };
}

export async function listCustomers(page = 1, limit = 20, q?: string) {
  const filter: Record<string, unknown> = { role: 'customer' };
  if (q?.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
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

export async function listUsers(
  page = 1,
  limit = 20,
  q?: string,
  role?: 'staff' | StaffRole | 'all'
) {
  const filter: Record<string, unknown> = { isGuest: { $ne: true } };
  if (role === 'staff') {
    filter.role = { $in: [...STAFF_ROLES] };
  } else if (role && role !== 'all') {
    filter.role = role;
  }
  if (q?.trim()) {
    const rx = new RegExp(escapeRegex(q.trim()), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ role: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function createStaffUser(input: {
  name?: string;
  email: string;
  password: string;
  role: StaffRole;
}) {
  const email = input.email.trim().toLowerCase();
  const role = input.role;
  if (!isStaffRole(role) || role === 'admin') {
    throw new ApiError(400, 'Owner role cannot be assigned — choose a staff role');
  }

  const existing = await User.findOne({ email }).select('+password +refreshToken');
  if (existing && !existing.isGuest) {
    throw new ApiError(409, 'Email already registered');
  }

  const name =
    input.name?.trim() ||
    email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'User';

  let user = existing;
  if (user) {
    user.name = name;
    user.password = input.password;
    user.role = role;
    user.isGuest = false;
    user.isActive = true;
    user.emailVerified = !isProd;
    user.refreshToken = undefined;
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      password: input.password,
      role,
      isGuest: false,
      isActive: true,
      emailVerified: !isProd,
    });
  }

  if (isProd) await sendVerificationEmail(user);
  return user;
}

export async function setUserRole(
  targetId: string,
  nextRole: StaffRole | 'customer',
  actorId: string
) {
  if (nextRole === 'admin') {
    throw new ApiError(400, 'Owner role cannot be assigned');
  }
  if (nextRole !== 'customer' && !isStaffRole(nextRole)) {
    throw new ApiError(400, 'Invalid role');
  }

  const target = await User.findById(targetId);
  if (!target) throw new ApiError(404, 'User not found');
  if (target.isGuest) throw new ApiError(400, 'Guest accounts cannot be given a role');

  if (target.role === 'admin') {
    throw new ApiError(400, 'Owner account cannot be changed or removed');
  }

  if (target.role === nextRole) return target;

  if (target._id.toString() === actorId && nextRole === 'customer') {
    throw new ApiError(400, 'You cannot remove your own staff access');
  }

  target.role = nextRole;
  if (isStaffRole(nextRole)) {
    target.isGuest = false;
    target.isActive = true;
  }
  target.refreshToken = undefined;
  await target.save();

  return target;
}

export async function listMessages(page = 1, limit = 20, status?: string) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ContactMessage.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function updateMessageStatus(id: string, status: 'new' | 'read' | 'archived') {
  return ContactMessage.findByIdAndUpdate(id, { status }, { new: true });
}

export async function listSubscribers() {
  return NewsletterSubscriber.find({ isActive: true }).sort({ createdAt: -1 }).limit(200);
}
