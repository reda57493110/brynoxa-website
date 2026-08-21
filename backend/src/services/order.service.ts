import { Types } from 'mongoose';
import { Product } from '../models/Product';
import { Order, OrderStatus } from '../models/Order';
import { Coupon } from '../models/Coupon';
import { Notification } from '../models/Notification';
import { getSettings } from '../models/Settings';
import { ApiError } from '../utils/ApiError';
import { IAddress, User } from '../models/User';

function generateOrderNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BRX-${stamp}-${rand}`;
}

export async function validateCoupon(code: string, subtotal: number) {
  const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });
  if (!coupon) throw new ApiError(404, 'Invalid coupon');
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw new ApiError(400, 'Coupon not active yet');
  if (coupon.expiresAt && coupon.expiresAt < now) throw new ApiError(400, 'Coupon expired');
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
    throw new ApiError(400, 'Coupon usage limit reached');
  }
  if (subtotal < coupon.minOrder) {
    throw new ApiError(400, `Minimum order of ${coupon.minOrder} DH required`);
  }

  let discount = 0;
  if (coupon.type === 'percent') {
    discount = (subtotal * coupon.value) / 100;
  } else {
    discount = coupon.value;
  }
  discount = Math.min(discount, subtotal);

  return { coupon, discount };
}

async function buildOrderLines(items: { productId: string; qty: number }[]) {
  if (!items.length) throw new ApiError(400, 'Add at least one product');

  const merged = new Map<string, number>();
  for (const item of items) {
    const id = item.productId;
    merged.set(id, (merged.get(id) || 0) + item.qty);
  }
  const uniqueItems = [...merged.entries()].map(([productId, qty]) => ({ productId, qty }));

  const productIds = uniqueItems.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  if (products.length !== productIds.length) {
    throw new ApiError(400, 'One or more products are unavailable');
  }

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  let subtotal = 0;
  const orderItems = uniqueItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new ApiError(400, 'Product not found');
    if (product.stock < item.qty) {
      throw new ApiError(400, `Insufficient stock for ${product.name}`);
    }
    const primary = product.images.find((img) => img.isPrimary) || product.images[0];
    subtotal += product.price * item.qty;
    return {
      product: product._id,
      name: product.name,
      image: primary?.url,
      sku: product.sku,
      price: product.price,
      qty: item.qty,
    };
  });

  return { orderItems, subtotal };
}

async function priceOrder(subtotal: number, couponCode?: string) {
  const settings = await getSettings();
  let discount = 0;
  let couponMeta: { code: string; couponId: Types.ObjectId } | undefined;

  if (couponCode) {
    try {
      const { coupon, discount: d } = await validateCoupon(couponCode, subtotal);
      discount = d;
      couponMeta = { code: coupon.code, couponId: coupon._id as Types.ObjectId };
    } catch {
      couponMeta = undefined;
      discount = 0;
    }
  }

  const shipping = 0;
  const taxable = Math.max(subtotal - discount, 0);
  const tax = (taxable * settings.taxRate) / 100;
  const total = taxable + shipping + tax;

  return {
    pricing: { subtotal, discount, shipping, tax, total },
    couponMeta,
  };
}

export async function createCodOrder(input: {
  userId: string;
  items: { productId: string; qty: number }[];
  shippingAddress: IAddress;
  couponCode?: string;
  customerNote?: string;
}) {
  const settings = await getSettings();
  if (!settings.codEnabled) throw new ApiError(400, 'Cash on delivery is disabled');

  const { orderItems, subtotal } = await buildOrderLines(input.items);
  const { pricing, couponMeta } = await priceOrder(subtotal, input.couponCode);

  const order = await Order.create({
    orderNumber: generateOrderNumber(),
    user: input.userId,
    items: orderItems,
    pricing,
    coupon: couponMeta,
    shippingAddress: input.shippingAddress,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    orderStatus: 'pending',
    timeline: [{ status: 'pending', note: 'Order placed — awaiting confirmation', at: new Date() }],
    customerNote: input.customerNote,
    stockReserved: false,
  });

  if (couponMeta) {
    await Coupon.findByIdAndUpdate(couponMeta.couponId, { $inc: { usedCount: 1 } });
  }

  await Notification.create({
    user: input.userId,
    type: 'order',
    title: 'Order placed',
    message: `Your order ${order.orderNumber} has been placed. Pay cash on delivery.`,
    link: `/account/orders/${order.orderNumber}`,
  });

  return order;
}

/** Guest confirmation: order number + email must match the account that placed it */
export async function getGuestOrderReceipt(orderNumber: string, email: string) {
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) throw new ApiError(404, 'Order not found');
  const order = await Order.findOne({ orderNumber, user: user._id });
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}

export async function updateUserOrderItems(
  userId: string,
  orderNumber: string,
  items: { productId: string; qty: number }[]
) {
  const order = await Order.findOne({ orderNumber, user: userId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.orderStatus !== 'pending') {
    throw new ApiError(400, 'Only pending orders can be edited');
  }
  if (order.stockReserved) {
    throw new ApiError(400, 'This order can no longer be edited');
  }

  const previousCouponCode = order.coupon?.code;
  const previousCouponId = order.coupon?.couponId;
  const { orderItems, subtotal } = await buildOrderLines(items);
  const { pricing, couponMeta } = await priceOrder(subtotal, previousCouponCode);

  if (previousCouponId && !couponMeta) {
    await Coupon.updateOne(
      { _id: previousCouponId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
  }
  if (!previousCouponId && couponMeta) {
    await Coupon.findByIdAndUpdate(couponMeta.couponId, { $inc: { usedCount: 1 } });
  }

  order.items = orderItems;
  order.pricing = pricing;
  if (couponMeta) {
    order.coupon = couponMeta;
  } else {
    order.set('coupon', undefined);
  }
  order.timeline.push({
    status: 'pending',
    note: 'Customer updated order items',
    at: new Date(),
  });
  await order.save();

  return order;
}

async function adjustStock(order: InstanceType<typeof Order>, direction: 'reserve' | 'restore') {
  for (const item of order.items) {
    const delta = direction === 'reserve' ? -item.qty : item.qty;
    const updated = await Product.findOneAndUpdate(
      {
        _id: item.product,
        ...(direction === 'reserve' ? { stock: { $gte: item.qty } } : {}),
      },
      {
        $inc: {
          stock: delta,
          soldCount: direction === 'reserve' ? item.qty : -item.qty,
        },
      },
      { new: true }
    );
    if (direction === 'reserve' && !updated) {
      throw new ApiError(400, `Insufficient stock for ${item.name}`);
    }
  }
}

export async function updateOrderStatus(
  orderId: string,
  orderStatus: OrderStatus,
  note?: string,
  adminNote?: string
) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const prev = order.orderStatus;
  if (prev === orderStatus) return order;

  if (orderStatus === 'confirmed' && !order.stockReserved) {
    await adjustStock(order, 'reserve');
    order.stockReserved = true;
  }

  if (orderStatus === 'cancelled' && order.stockReserved) {
    await adjustStock(order, 'restore');
    order.stockReserved = false;
  }

  if (orderStatus === 'delivered') {
    order.paymentStatus = 'paid';
  }

  if (orderStatus === 'cancelled' && order.paymentStatus === 'pending') {
    order.paymentStatus = 'failed';
  }

  if (orderStatus === 'cancelled' && prev !== 'cancelled' && order.coupon?.couponId) {
    await Coupon.updateOne(
      { _id: order.coupon.couponId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
  }

  order.orderStatus = orderStatus;
  order.timeline.push({
    status: orderStatus,
    note: note || `Status changed to ${orderStatus}`,
    at: new Date(),
  });
  if (adminNote !== undefined) order.adminNote = adminNote;
  await order.save();

  await Notification.create({
    user: order.user,
    type: 'order',
    title: 'Order updated',
    message: `Order ${order.orderNumber} is now ${orderStatus}.`,
    link: `/account/orders/${order.orderNumber}`,
  });

  return order;
}

export async function listUserOrders(userId: string, page = 1, limit = 10) {
  const filter = { user: userId };
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function getUserOrder(userId: string, orderNumber: string) {
  const order = await Order.findOne({ orderNumber, user: userId });
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}

export async function cancelUserOrder(userId: string, orderNumber: string) {
  const order = await Order.findOne({ orderNumber, user: userId });
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.orderStatus !== 'pending') {
    throw new ApiError(400, 'Only pending orders can be cancelled');
  }
  return updateOrderStatus(
    String(order._id),
    'cancelled',
    'Cancelled by customer'
  );
}

export async function listAllOrders(page = 1, limit = 20, status?: string, q?: string) {
  const filter: Record<string, unknown> = {};
  if (status) filter.orderStatus = status;
  if (q?.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.orderNumber = rx;
  }
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email'),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function getOrderById(id: string) {
  const order = await Order.findById(id).populate('user', 'name email phone');
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}
