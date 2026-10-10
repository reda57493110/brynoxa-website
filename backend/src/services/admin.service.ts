import { Order } from '../models/Order';
import { Product } from '../models/Product';
import { User } from '../models/User';
import { Review } from '../models/Review';
import { Wishlist } from '../models/Wishlist';
import { Notification } from '../models/Notification';
import { ContactMessage, NewsletterSubscriber } from '../models/Contact';
import { ApiError } from '../utils/ApiError';
import { isProd } from '../config/env';
import { sendVerificationEmail } from './auth.service';
import { isStaffRole, STAFF_ROLES, type StaffRole } from '../permissions';
import { STORE_TIMEZONE } from './dashboard.service';

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const DASHBOARD_CACHE_MS = 45_000;
let dashboardCache: { at: number; data: Awaited<ReturnType<typeof buildDashboardStats>> | null } = {
  at: 0,
  data: null,
};

export function invalidateDashboardCache() {
  dashboardCache = { at: 0, data: null };
}

export async function getDashboardStats() {
  const now = Date.now();
  if (dashboardCache.data && now - dashboardCache.at < DASHBOARD_CACHE_MS) {
    return dashboardCache.data;
  }
  const data = await buildDashboardStats();
  dashboardCache = { at: now, data };
  return data;
}

/**
 * Counts for the admin shell and dashboard (badges, order pipeline, catalog, stock).
 * Money figures live in dashboard.service (salesAnalytics), which follows the sales rules.
 */
async function buildDashboardStats() {
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const lowExpr = { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 5] }] };

  const [orderStats, customerCount, productStats, reviewCount, unreadMessages, recentOrders] =
    await Promise.all([
      Order.aggregate([
        {
          $facet: {
            counts: [
              {
                $group: {
                  _id: null,
                  orderCount: { $sum: 1 },
                  pendingOrders: { $sum: { $cond: [{ $eq: ['$orderStatus', 'pending'] }, 1, 0] } },
                },
              },
            ],
            byStatus: [{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }],
            // Orders placed today in the store's timezone (not the server's)
            today: [
              { $match: { createdAt: { $gte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }, orderStatus: { $ne: 'cancelled' } } },
              { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STORE_TIMEZONE } } } },
              { $match: { day: todayKey } },
              { $group: { _id: null, orders: { $sum: 1 }, total: { $sum: '$pricing.total' } } },
            ],
          },
        },
      ]),
      User.countDocuments({ role: 'customer' }),
      Product.aggregate([
        {
          $facet: {
            productCount: [{ $count: 'n' }],
            activeProducts: [{ $match: { isActive: true } }, { $count: 'n' }],
            // Same rules as the Inventory page: low = 1..alert level, out = nothing sellable
            lowStock: [{ $match: { stock: { $gt: 0 }, $expr: lowExpr } }, { $count: 'n' }],
            outOfStock: [{ $match: { stock: { $lte: 0 } } }, { $count: 'n' }],
            lowStockProducts: [
              { $match: { $expr: lowExpr } },
              { $sort: { isActive: -1, stock: 1, name: 1 } },
              { $limit: 6 },
              { $project: { name: 1, variantLabel: 1, sku: 1, stock: 1, slug: 1, images: { $slice: ['$images', 1] }, lowStockThreshold: 1, isActive: 1 } },
            ],
          },
        },
      ]),
      Review.countDocuments(),
      ContactMessage.countDocuments({ status: 'new' }),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('user', 'name')
        .select('orderNumber orderStatus paymentStatus pricing.total createdAt user shippingAddress.fullName')
        .lean(),
    ]);

  const facet = orderStats[0] || { counts: [], byStatus: [], today: [] };
  const productsFacet = productStats[0] || {};
  const n = (rows?: { n: number }[]) => rows?.[0]?.n || 0;

  const statusMap: Record<string, number> = {};
  for (const row of facet.byStatus || []) {
    statusMap[row._id] = row.count;
  }

  return {
    todayOrders: facet.today[0]?.orders || 0,
    todayOrderValue: facet.today[0]?.total || 0,
    orderCount: facet.counts[0]?.orderCount || 0,
    pendingOrders: facet.counts[0]?.pendingOrders || 0,
    customerCount,
    productCount: n(productsFacet.productCount),
    activeProducts: n(productsFacet.activeProducts),
    lowStock: n(productsFacet.lowStock),
    outOfStock: n(productsFacet.outOfStock),
    reviewCount,
    unreadMessages,
    recentOrders: recentOrders || [],
    ordersByStatus: statusMap,
    lowStockProducts: productsFacet.lowStockProducts || [],
  };
}

export async function deleteCustomer(id: string) {
  const user = await User.findOne({ _id: id, role: 'customer' });
  if (!user) throw new ApiError(404, 'Customer not found');

  await Promise.all([
    Wishlist.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    Review.deleteMany({ user: user._id }),
    User.deleteOne({ _id: user._id, role: 'customer' }),
  ]);

  invalidateDashboardCache();
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
