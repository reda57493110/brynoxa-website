import { Types } from 'mongoose';
import { Product } from '../models/Product';
import { IOrderDeposit, Order, OrderStatus } from '../models/Order';
import { Coupon } from '../models/Coupon';
import { Notification } from '../models/Notification';
import { getSettings } from '../models/Settings';
import { resolveShippingFee } from '../utils/shipping';
import { lineDeposit, roundMoney } from '../utils/deposit';
import { wholesaleUnitPrice, type WholesaleTerms } from '../utils/wholesale';
import { getWholesaleTerms } from './wholesale.service';
import { ApiError } from '../utils/ApiError';
import { IAddress } from '../models/User';
import { createHash, randomBytes } from 'crypto';
import { waitUntil } from '@vercel/functions';
import {
  notifyDepositReceived,
  notifyDepositRequested,
  notifyOrderPlaced,
  notifyOrderStatusChanged,
  statusNotificationCopy,
} from './orderNotify.service';
import { invalidateDashboardCache } from './admin.service';

function generateOrderNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `BRX-${stamp}-${rand}`;
}

function hashReceiptToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

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

async function claimCoupon(couponId: Types.ObjectId) {
  const now = new Date();
  const coupon = await Coupon.findOneAndUpdate(
    {
      _id: couponId,
      isActive: true,
      $and: [
        { $or: [{ startsAt: { $exists: false } }, { startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: [{ maxUses: { $lte: 0 } }, { $expr: { $lt: ['$usedCount', '$maxUses'] } }] },
      ],
    },
    { $inc: { usedCount: 1 } },
    { new: true }
  );
  if (!coupon) {
    throw new ApiError(400, 'Coupon is no longer available');
  }
  return coupon;
}

/**
 * Prices order lines from the current catalog. With wholesale terms, each line is charged the
 * tier price; listPrice keeps the catalog price and unitCost the product cost at this moment.
 */
async function buildOrderLines(
  items: { productId: string; qty: number }[],
  terms?: WholesaleTerms | null
) {
  if (!items.length) throw new ApiError(400, 'Add at least one product');

  const merged = new Map<string, number>();
  for (const item of items) {
    const id = item.productId;
    merged.set(id, (merged.get(id) || 0) + item.qty);
  }
  const uniqueItems = [...merged.entries()].map(([productId, qty]) => ({ productId, qty }));

  const productIds = uniqueItems.map((i) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true }).select('+costPrice');
  if (products.length !== productIds.length) {
    throw new ApiError(400, 'One or more products are unavailable');
  }

  const productMap = new Map(products.map((p) => [p._id.toString(), p]));
  let subtotal = 0;
  let depositTotal = 0;
  let wholesaleDiscount = 0;
  const orderItems = uniqueItems.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new ApiError(400, 'Product not found');
    if (product.stock < item.qty) {
      throw new ApiError(400, `Insufficient stock for ${product.name}`);
    }
    const primary = product.images.find((img) => img.isPrimary) || product.images[0];
    const price = terms ? wholesaleUnitPrice(product.price, terms.discountPercent) : product.price;
    subtotal += price * item.qty;
    wholesaleDiscount += (product.price - price) * item.qty;
    depositTotal += lineDeposit(product.deposit, price, item.qty);
    return {
      product: product._id,
      name: product.name,
      image: primary?.url,
      sku: product.sku,
      price,
      listPrice: product.price,
      unitCost: typeof product.costPrice === 'number' ? product.costPrice : undefined,
      qty: item.qty,
    };
  });

  return {
    orderItems,
    subtotal: roundMoney(subtotal),
    wholesaleDiscount: roundMoney(wholesaleDiscount),
    depositTotal: roundMoney(depositTotal),
  };
}

/** Deposit from product rules, capped at the order total; undefined when none applies. */
function productsDeposit(depositTotal: number, total: number): IOrderDeposit | undefined {
  const amount = roundMoney(Math.min(depositTotal, total));
  return amount > 0 ? { amount, source: 'products', status: 'pending' } : undefined;
}

const formatDh = (amount: number) => `${amount.toLocaleString('en-US')} DH`;

async function priceOrder(subtotal: number, couponCode?: string, city?: string) {
  const settings = await getSettings();
  let discount = 0;
  let couponMeta: { code: string; couponId: Types.ObjectId } | undefined;

  if (couponCode) {
    const { coupon, discount: d } = await validateCoupon(couponCode, subtotal);
    discount = d;
    couponMeta = { code: coupon.code, couponId: coupon._id as Types.ObjectId };
  }

  const shipping = resolveShippingFee(settings, city, subtotal);
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

  // Wholesale prices only for approved accounts; the channel is fixed on the order from now on
  const terms = await getWholesaleTerms(input.userId);
  const { orderItems, subtotal, wholesaleDiscount, depositTotal } = await buildOrderLines(input.items, terms);
  const { pricing, couponMeta } = await priceOrder(
    subtotal,
    input.couponCode,
    input.shippingAddress?.city
  );
  const deposit = productsDeposit(depositTotal, pricing.total);

  let couponClaimed = false;
  if (couponMeta) {
    await claimCoupon(couponMeta.couponId);
    couponClaimed = true;
  }

  const receiptToken = randomBytes(32).toString('hex');
  let order: InstanceType<typeof Order>;
  try {
    order = await Order.create({
      orderNumber: generateOrderNumber(),
      receiptTokenHash: hashReceiptToken(receiptToken),
      user: input.userId,
      items: orderItems,
      pricing: { ...pricing, wholesaleDiscount },
      channel: terms ? 'wholesale' : 'retail',
      wholesaleTier: terms ? { id: terms.tierId, name: terms.tierName, discountPercent: terms.discountPercent } : undefined,
      coupon: couponMeta,
      shippingAddress: input.shippingAddress,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      deposit,
      orderStatus: 'pending',
      timeline: [
        {
          status: 'pending',
          note: deposit
            ? `Order placed — awaiting deposit of ${formatDh(deposit.amount)}`
            : 'Order placed — awaiting confirmation',
          at: new Date(),
        },
      ],
      customerNote: input.customerNote,
      stockReserved: false,
    });
  } catch (error) {
    if (couponClaimed && couponMeta) {
      await Coupon.updateOne({ _id: couponMeta.couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    }
    throw error;
  }

  try {
    const copy = statusNotificationCopy('pending');
    await Notification.create({
      user: input.userId,
      type: 'order',
      title: copy.title,
      message: `${copy.customerLine} (${order.orderNumber})`,
      link: `/account/orders/${order.orderNumber}`,
    });
  } catch (error) {
    console.error('Order notification failed', error);
  }

  waitUntil(
    notifyOrderPlaced(order).catch((error) => {
      console.error('Order placed email failed', error);
    })
  );

  return { order, receiptToken };
}

/** Guest confirmation: order number plus a high-entropy receipt token. */
export async function getGuestOrderReceipt(orderNumber: string, receiptToken: string) {
  const order = await Order.findOne({
    orderNumber,
    receiptTokenHash: hashReceiptToken(receiptToken),
  });
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}

/** Normalize Moroccan / international phone digits for comparison. */
export function normalizePhoneDigits(phone: string) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('212') && digits.length >= 12) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits;
}

function phonesMatch(a: string, b: string) {
  const left = normalizePhoneDigits(a);
  const right = normalizePhoneDigits(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const minLen = Math.min(left.length, right.length);
  if (minLen < 8) return false;
  return left.endsWith(right) || right.endsWith(left);
}

/**
 * Public guest tracking: order number + delivery phone.
 * Always returns the same 404 message to avoid leaking which field failed.
 */
export async function trackGuestOrder(orderNumber: string, phone: string) {
  const normalizedNumber = orderNumber.trim().toUpperCase();
  const order = await Order.findOne({
    $or: [{ orderNumber: orderNumber.trim() }, { orderNumber: normalizedNumber }],
  });
  if (!order || !phonesMatch(order.shippingAddress?.phone || '', phone)) {
    throw new ApiError(404, 'We could not find an order with those details');
  }
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
  if (order.stockReserved || order.deposit?.status === 'received') {
    throw new ApiError(400, 'This order can no longer be edited');
  }

  const previousCouponCode = order.coupon?.code;
  const previousCouponId = order.coupon?.couponId;
  // Keep the channel and tier the order was placed with, even if the account changed since
  const terms = order.wholesaleTier
    ? { tierId: order.wholesaleTier.id, tierName: order.wholesaleTier.name, discountPercent: order.wholesaleTier.discountPercent }
    : null;
  const { orderItems, subtotal, wholesaleDiscount, depositTotal } = await buildOrderLines(items, terms);
  const { pricing: basePricing, couponMeta } = await priceOrder(
    subtotal,
    previousCouponCode,
    order.shippingAddress?.city
  );
  const pricing = { ...basePricing, wholesaleDiscount };

  // A deposit set by staff is kept (capped at the new total); otherwise follow the products.
  const deposit: IOrderDeposit | undefined =
    order.deposit?.source === 'admin'
      ? {
          amount: roundMoney(Math.min(order.deposit.amount, pricing.total)),
          source: 'admin',
          status: 'pending',
        }
      : productsDeposit(depositTotal, pricing.total);

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
  if (deposit) order.deposit = deposit;
  else order.set('deposit', undefined);
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
  const changed: { productId: Types.ObjectId; stockDelta: number; soldDelta: number }[] = [];

  try {
    // Parallel atomic updates (each line is its own findOneAndUpdate).
    const results = await Promise.all(
      order.items.map(async (item) => {
        const stockDelta = direction === 'reserve' ? -item.qty : item.qty;
        const soldDelta = direction === 'reserve' ? item.qty : -item.qty;
        const updated = await Product.findOneAndUpdate(
          {
            _id: item.product,
            ...(direction === 'reserve' ? { stock: { $gte: item.qty } } : {}),
          },
          {
            $inc: {
              stock: stockDelta,
              soldCount: soldDelta,
            },
          },
          { new: true }
        );
        return { item, updated, stockDelta, soldDelta };
      })
    );

    for (const { item, updated, stockDelta, soldDelta } of results) {
      if (direction === 'reserve' && !updated) {
        throw new ApiError(400, `Insufficient stock for ${item.name}`);
      }
      if (!updated) {
        throw new ApiError(400, `Product unavailable for ${item.name}`);
      }
      changed.push({
        productId: item.product as Types.ObjectId,
        stockDelta,
        soldDelta,
      });
    }
  } catch (error) {
    await Promise.all(
      changed.map(({ productId, stockDelta, soldDelta }) =>
        Product.updateOne(
          { _id: productId },
          { $inc: { stock: -stockDelta, soldCount: -soldDelta } }
        )
      )
    );
    throw error;
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
  if (!ORDER_TRANSITIONS[prev].includes(orderStatus)) {
    throw new ApiError(400, `Cannot move an order from ${prev} to ${orderStatus}`);
  }

  if (orderStatus === 'confirmed' && order.deposit && order.deposit.status !== 'received') {
    throw new ApiError(400, 'Mark the deposit as received before confirming this order');
  }

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

  invalidateDashboardCache();

  try {
    const copy = statusNotificationCopy(orderStatus);
    await Notification.create({
      user: order.user,
      type: 'order',
      title: copy.title,
      message: `${copy.customerLine} (${order.orderNumber})`,
      link: `/account/orders/${order.orderNumber}`,
    });
  } catch (error) {
    console.error('Order status notification failed', error);
  }

  waitUntil(
    notifyOrderStatusChanged(order, orderStatus).catch((error) => {
      console.error('Order status email failed', error);
    })
  );

  return order;
}

/**
 * Staff: set the deposit on a pending order (amount 0 removes it) and/or mark it received.
 * Changing the amount resets it to "awaiting".
 */
export async function setOrderDeposit(
  orderId: string,
  input: { amount?: number; received?: boolean }
) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  if (order.orderStatus !== 'pending') {
    throw new ApiError(400, 'The deposit can only be changed while the order is pending');
  }

  const notes: string[] = [];
  let customerMessage = '';
  let email: 'requested' | 'received' | null = null;

  if (input.amount !== undefined) {
    const amount = roundMoney(input.amount);
    if (amount > order.pricing.total) {
      throw new ApiError(400, 'The deposit cannot be more than the order total');
    }
    if (amount === 0) {
      if (order.deposit) {
        order.set('deposit', undefined);
        notes.push('Deposit removed');
        customerMessage = 'No deposit is needed for this order anymore';
      }
    } else if (amount !== order.deposit?.amount) {
      order.deposit = { amount, source: 'admin', status: 'pending' };
      notes.push(`Deposit of ${formatDh(amount)} requested`);
      customerMessage = `A deposit of ${formatDh(amount)} is needed to confirm this order`;
      email = 'requested';
    }
  }

  if (input.received !== undefined) {
    if (!order.deposit) throw new ApiError(400, 'This order has no deposit');
    const status = input.received ? 'received' : 'pending';
    if (order.deposit.status !== status) {
      order.deposit.status = status;
      order.deposit.receivedAt = input.received ? new Date() : undefined;
      notes.push(input.received ? 'Deposit received' : 'Deposit marked as not received');
      if (input.received) {
        customerMessage = 'We received your deposit';
        email = 'received';
      }
    }
  }

  if (!notes.length) return order;

  for (const note of notes) {
    order.timeline.push({ status: 'pending', note, at: new Date() });
  }
  order.markModified('deposit');
  await order.save();
  invalidateDashboardCache();

  if (customerMessage) {
    try {
      await Notification.create({
        user: order.user,
        type: 'order',
        title: 'Order deposit',
        message: `${customerMessage} (${order.orderNumber})`,
        link: `/account/orders/${order.orderNumber}`,
      });
    } catch (error) {
      console.error('Deposit notification failed', error);
    }
  }

  if (email) {
    const send = email === 'received' ? notifyDepositReceived : notifyDepositRequested;
    waitUntil(
      send(order).catch((error) => {
        console.error('Deposit email failed', error);
      })
    );
  }

  return order;
}

/** Money the customer has actually paid on an order: the full total once delivered, else a received deposit. */
export function amountPaidOnOrder(order: { orderStatus: OrderStatus; pricing: { total: number }; deposit?: { amount: number; status: string } | null }) {
  if (order.orderStatus === 'delivered') return order.pricing.total;
  return order.deposit?.status === 'received' ? order.deposit.amount : 0;
}

/**
 * Staff record money given back to the customer. Capped at what was actually paid minus earlier
 * refunds, so the same payment can never be refunded (or counted) twice.
 */
export async function recordRefund(
  orderId: string,
  input: { amount: number; reason: string; itemsReturned?: boolean },
  actorId: string
) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');

  const paid = amountPaidOnOrder(order);
  const alreadyRefunded = (order.refunds || []).reduce((sum, r) => sum + r.amount, 0);
  const refundable = roundMoney(paid - alreadyRefunded);
  const amount = roundMoney(input.amount);
  if (paid <= 0) throw new ApiError(400, 'Nothing has been paid on this order yet');
  if (!(amount > 0) || amount > refundable) {
    throw new ApiError(400, `The refund must be between 0 and ${formatDh(refundable)}`);
  }

  order.refunds.push({
    amount,
    reason: input.reason.trim(),
    itemsReturned: Boolean(input.itemsReturned),
    at: new Date(),
    by: actorId as never,
  });
  if (order.orderStatus === 'delivered' && alreadyRefunded + amount >= paid) {
    order.paymentStatus = 'refunded';
  }
  order.timeline.push({
    status: order.orderStatus,
    note: `Refund of ${formatDh(amount)} recorded${input.itemsReturned ? ' (items returned)' : ''}: ${input.reason.trim()}`,
    at: new Date(),
  });
  await order.save();
  invalidateDashboardCache();

  try {
    await Notification.create({
      user: order.user,
      type: 'order',
      title: 'Refund',
      message: `A refund of ${formatDh(amount)} was recorded (${order.orderNumber})`,
      link: `/account/orders/${order.orderNumber}`,
    });
  } catch (error) {
    console.error('Refund notification failed', error);
  }
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
  if (order.deposit?.status === 'received') {
    throw new ApiError(400, 'Your deposit has been received. Contact us to cancel and arrange the refund.');
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
      .populate('user', 'name email')
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function getOrderById(id: string) {
  const order = await Order.findById(id).populate('user', 'name email phone');
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}

export async function deleteOrder(id: string) {
  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, 'Order not found');

  if (order.stockReserved) {
    await adjustStock(order, 'restore');
    order.stockReserved = false;
  }

  if (order.coupon?.couponId && order.orderStatus !== 'cancelled') {
    await Coupon.updateOne(
      { _id: order.coupon.couponId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
  }

  await Order.deleteOne({ _id: order._id });
  await Notification.deleteMany({
    $or: [
      { link: `/account/orders/${order.orderNumber}` },
      { link: `/admin/orders/${order._id}` },
      { message: new RegExp(order.orderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) },
    ],
  });

  invalidateDashboardCache();
}
