import { Types } from 'mongoose';
import { Product } from '../models/Product';
import { IOrderDeposit, Order, OrderStatus } from '../models/Order';
import { Coupon } from '../models/Coupon';
import { Notification } from '../models/Notification';
import { getSettings, type DepositMethod } from '../models/Settings';
import { resolveShippingFee } from '../utils/shipping';
import { dueOnDelivery, feeCreditOf, lineDeposit, roundMoney } from '../utils/deposit';
import { wholesaleUnitPrice, type WholesaleTerms } from '../utils/wholesale';
import { getWholesaleTerms } from './wholesale.service';
import { dispatchOrderStock, releaseOrderStock, reserveOrderStock } from './orderStock.service';
import { ApiError } from '../utils/ApiError';
import { DepositProof } from '../models/DepositProof';
import { DepositReceipt } from '../models/DepositReceipt';
import { IAddress } from '../models/User';
import { createHash, randomBytes, randomInt } from 'crypto';
import { waitUntil } from '@vercel/functions';
import {
  notifyDepositReceived,
  notifyDepositRequested,
  notifyOrderPlaced,
  notifyOrderStatusChanged,
  statusNotificationCopy,
} from './orderNotify.service';
import { invalidateDashboardCache } from './admin.service';
import { User } from '../models/User';
import { ORDER_ORIGIN_LABEL, guestLabel, originFilter, type OrderOrigin } from '../utils/orderOrigin';
import {
  DELIVERY_ISSUES,
  ORDER_STATUSES,
  ORDER_STATUS_GROUPS,
  ORDER_TRANSITIONS,
  RECEIPT_STATUSES,
  attentionFilter,
  statusesInGroup,
  wasDelivered,
  type DeliveryIssue,
  type OrderStatusGroup,
} from '../utils/orderStatus';

// No 0/O or 1/I, so a number read over the phone is not misheard
const ORDER_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** BRX-YYYYMMDD-XXXXXX: 6 random characters (about a billion per day), so it cannot be guessed. */
export function generateOrderNumber() {
  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let code = '';
  for (let i = 0; i < 6; i++) code += ORDER_CODE_CHARS[randomInt(ORDER_CODE_CHARS.length)];
  return `BRX-${stamp}-${code}`;
}

function hashReceiptToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}


/** Lines of the cart / order a special-price coupon is checked against. */
export type CouponLine = { product: unknown; price: number; qty: number };

/**
 * Special-price coupon: on each chosen product the customer pays the special price instead of
 * the price of the line (never more than the line); other products are not touched.
 */
export function specialPriceDiscount(productPrices: { product: unknown; price: number }[], lines: CouponLine[]) {
  const special = new Map(productPrices.map((p) => [String(p.product), p.price]));
  let discount = 0;
  for (const l of lines) {
    const price = special.get(String(l.product));
    if (price !== undefined && l.price > price) discount += (l.price - price) * l.qty;
  }
  return roundMoney(discount);
}

/** Checkout preview: the cart lines priced from the catalog (the order itself is priced again). */
export async function couponLinesFor(items?: { productId: string; qty: number }[]): Promise<CouponLine[] | undefined> {
  if (!items?.length) return undefined;
  const ids = items.map((i) => i.productId).filter((id) => Types.ObjectId.isValid(id));
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).select('price');
  const price = new Map(products.map((p) => [String(p._id), p.price]));
  return items.filter((i) => price.has(i.productId)).map((i) => ({ product: i.productId, price: price.get(i.productId)!, qty: i.qty }));
}

export async function validateCoupon(code: string, subtotal: number, lines?: CouponLine[]) {
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
  if (coupon.type === 'price') {
    discount = specialPriceDiscount(coupon.productPrices || [], lines || []);
    if (discount <= 0) throw new ApiError(400, 'This coupon is for other products');
  } else if (coupon.type === 'percent') {
    discount = (subtotal * coupon.value) / 100;
  } else {
    discount = coupon.value;
  }
  discount = Math.min(discount, subtotal);

  return { coupon, discount };
}

/** Same phone written differently ("06 12-34", "+212 6 12 34") → its last 9 digits. */
export function phoneKey(phone?: string) {
  return String(phone || '').replace(/\D/g, '').slice(-9);
}

/**
 * A coupon limited per customer: counts this person's orders that used it (not cancelled), by
 * account or by phone number — a guest giving a new email each time still has the same phone.
 */
async function assertCouponPerCustomer(couponId: Types.ObjectId, limit: number, userId: string, phone?: string) {
  if (!limit || limit <= 0) return;
  const key = phoneKey(phone);
  const used = await Order.find(
    { 'coupon.couponId': couponId, orderStatus: { $ne: 'cancelled' } },
    { user: 1, 'shippingAddress.phone': 1 }
  )
    .limit(5000)
    .lean();
  const mine = used.filter(
    (o) => String(o.user) === String(userId) || (key.length >= 8 && phoneKey(o.shippingAddress?.phone) === key)
  ).length;
  if (mine >= limit) {
    throw new ApiError(400, limit === 1 ? 'You have already used this coupon' : `This coupon can be used ${limit} times per customer`);
  }
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
  items: { productId: string; qty: number; price?: number }[],
  terms?: WholesaleTerms | null,
  opts: { staff?: boolean } = {}
) {
  if (!items.length) throw new ApiError(400, 'Add at least one product');

  const merged = new Map<string, { qty: number; price?: number }>();
  for (const item of items) {
    if (!Types.ObjectId.isValid(item.productId)) throw new ApiError(400, 'One or more products are unavailable');
    const prev = merged.get(item.productId);
    // An agreed price only from staff (the first one given for that product)
    const price = opts.staff ? (prev?.price ?? item.price) : undefined;
    merged.set(item.productId, { qty: (prev?.qty || 0) + item.qty, price });
  }
  const uniqueItems = [...merged.entries()].map(([productId, v]) => ({ productId, ...v }));

  const productIds = uniqueItems.map((i) => i.productId);
  // Staff can also sell a product that is hidden from the shop
  const products = await Product.find({ _id: { $in: productIds }, ...(opts.staff ? {} : { isActive: true }) }).select('+costPrice');
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
    const price =
      typeof item.price === 'number'
        ? roundMoney(item.price)
        : terms
          ? wholesaleUnitPrice(product.price, terms.discountPercent)
          : product.price;
    subtotal += price * item.qty;
    wholesaleDiscount += (product.price - price) * item.qty;
    depositTotal += lineDeposit(product.deposit, price, item.qty);
    return {
      product: product._id,
      // Variants share a name; keep the chosen options with the line
      name: product.variantLabel ? `${product.name} (${product.variantLabel})` : product.name,
      image: primary?.url,
      sku: product.sku,
      price,
      listPrice: product.price,
      condition: product.condition || 'new',
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

async function priceOrder(subtotal: number, couponCode?: string, city?: string, lines?: CouponLine[]) {
  const settings = await getSettings();
  let discount = 0;
  let couponMeta: { code: string; couponId: Types.ObjectId; perCustomerLimit: number } | undefined;

  if (couponCode) {
    const { coupon, discount: d } = await validateCoupon(couponCode, subtotal, lines);
    discount = d;
    couponMeta = { code: coupon.code, couponId: coupon._id as Types.ObjectId, perCustomerLimit: coupon.perCustomerLimit || 0 };
  }

  const taxable = Math.max(subtotal - discount, 0);
  // Free-shipping minimum is checked on what the customer pays for the items, after the coupon
  const shipping = resolveShippingFee(settings, city, taxable);
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
  // Wholesale prices only for approved accounts; the channel is fixed on the order from now on
  const terms = await getWholesaleTerms(input.userId);
  const { orderItems, subtotal, wholesaleDiscount, depositTotal } = await buildOrderLines(input.items, terms);
  const { pricing, couponMeta } = await priceOrder(
    subtotal,
    input.couponCode,
    input.shippingAddress?.city,
    orderItems
  );
  const deposit = productsDeposit(depositTotal, pricing.total);

  let couponClaimed = false;
  if (couponMeta) {
    await assertCouponPerCustomer(couponMeta.couponId, couponMeta.perCustomerLimit, input.userId, input.shippingAddress?.phone);
    await claimCoupon(couponMeta.couponId);
    couponClaimed = true;
  }

  const receiptToken = randomBytes(32).toString('hex');
  let order!: InstanceType<typeof Order>;
  try {
    // A clash on the order number is extremely unlikely; try a fresh number if it happens
    for (let attempt = 1; ; attempt++) {
      try {
        order = await createOrderDoc(generateOrderNumber());
        break;
      } catch (err) {
        const dup = (err as { code?: number; keyPattern?: Record<string, unknown> })?.code === 11000;
        const onNumber = Boolean((err as { keyPattern?: Record<string, unknown> })?.keyPattern?.orderNumber);
        if (!dup || !onNumber || attempt >= 3) throw err;
      }
    }
  } catch (error) {
    if (couponClaimed && couponMeta) {
      await Coupon.updateOne({ _id: couponMeta.couponId, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    }
    throw error;
  }

  function createOrderDoc(orderNumber: string) {
    return Order.create({
      orderNumber,
      receiptTokenHash: hashReceiptToken(receiptToken),
      user: input.userId,
      items: orderItems,
      pricing: { ...pricing, wholesaleDiscount },
      channel: terms ? 'wholesale' : 'retail',
      wholesaleTier: terms ? { id: terms.tierId, name: terms.tierName, discountPercent: terms.discountPercent } : undefined,
      coupon: couponMeta ? { code: couponMeta.code, couponId: couponMeta.couponId } : undefined,
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
  }

  try {
    const copy = statusNotificationCopy('pending')!;
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

/** Last 9 digits as a pattern that also matches "06 12-34 56 78", "+212612345678"… */
function phonePattern(phone: string) {
  const digits = phoneKey(phone);
  return digits.length >= 8 ? new RegExp(`${digits.split('').join('\\D*')}\\D*$`) : null;
}

/**
 * The customer of an order entered by staff: the account with this email, else the one with this
 * phone number, else a new guest. Without an email, the guest gets an address on the reserved
 * ".invalid" domain, which is never emailed (email.service skips it).
 */
export async function resolveManualCustomer(
  input: { fullName: string; phone: string; email?: string; city: string; line1?: string },
  origin?: OrderOrigin
) {
  const email = input.email?.trim().toLowerCase();
  let user = email ? await User.findOne({ email }) : null;
  if (user && user.role !== 'customer') throw new ApiError(400, 'This email belongs to a staff account — use the customer\'s own email');
  if (!user) {
    const rx = phonePattern(input.phone);
    if (rx) user = await User.findOne({ phone: rx, role: 'customer' }).sort({ isGuest: 1, createdAt: 1 });
  }
  if (!user) {
    user = await User.create({
      name: input.fullName,
      email: email || `phone-${phoneKey(input.phone) || 'x'}-${randomBytes(4).toString('hex')}@no-email.invalid`,
      password: randomBytes(24).toString('hex'),
      phone: input.phone,
      isGuest: true,
      // Shown as "Ahmed / TikTok" in Customers, so staff see where the customer came from
      source: origin && origin !== 'website' ? origin : undefined,
      addresses: [
        {
          label: 'Home',
          fullName: input.fullName,
          line1: input.line1 || input.city,
          city: input.city,
          postalCode: '00000',
          country: 'MA',
          phone: input.phone,
          isDefault: true,
        },
      ],
    });
  }
  return user;
}

/**
 * An order from social media, a phone call or the shop, entered by staff. Same lines, stock and
 * profit rules as a website order; the customer gets no messages. It can start as new (to
 * confirm), confirmed (stock reserved) or already delivered and paid (a sale in the shop).
 */
export async function createManualOrder(
  input: {
    origin: string;
    items: { productId: string; qty: number; price?: number }[];
    customer: { fullName?: string; phone: string; email?: string; city: string; line1?: string };
    shipping?: number;
    discount?: number;
    deliveryCost?: number;
    status?: 'pending' | 'confirmed' | 'delivered';
    adminNote?: string;
  },
  staffId: string
) {
  const origin = input.origin as OrderOrigin;
  const { orderItems, subtotal } = await buildOrderLines(input.items, null, { staff: true });
  const settings = await getSettings();
  const discount = roundMoney(Math.min(Math.max(input.discount || 0, 0), subtotal));
  const shipping = roundMoney(Math.max(input.shipping || 0, 0));
  const taxable = Math.max(subtotal - discount, 0);
  const tax = roundMoney((taxable * settings.taxRate) / 100);
  const pricing = { subtotal, discount, shipping, tax, total: roundMoney(taxable + shipping + tax), wholesaleDiscount: 0 };

  // No name given: "Guest TikTok", so the customer is still easy to recognise
  const c = { ...input.customer, fullName: input.customer.fullName?.trim() || guestLabel(origin) };
  const user = await resolveManualCustomer(c, origin);
  // A sale in the shop has no courier; otherwise the amount given, else the default courier price
  const deliveryCost = typeof input.deliveryCost === 'number' ? input.deliveryCost : origin === 'store' ? 0 : undefined;

  let order!: InstanceType<typeof Order>;
  for (let attempt = 1; ; attempt++) {
    try {
      order = await Order.create({
        orderNumber: generateOrderNumber(),
        user: user._id,
        items: orderItems,
        pricing,
        channel: 'retail',
        origin,
        createdBy: staffId,
        shippingAddress: {
          fullName: c.fullName,
          line1: c.line1 || (origin === 'store' ? 'In the shop' : c.city),
          city: c.city,
          postalCode: '00000',
          country: 'MA',
          phone: c.phone,
        },
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        costs: deliveryCost !== undefined ? { delivery: deliveryCost } : undefined,
        orderStatus: 'pending',
        timeline: [{ status: 'pending', note: `Order added by staff — from ${ORDER_ORIGIN_LABEL[origin]}`, at: new Date(), by: staffId }],
        adminNote: input.adminNote?.trim() || undefined,
        stockReserved: false,
      });
      break;
    } catch (err) {
      const e = err as { code?: number; keyPattern?: Record<string, unknown> };
      if (!(e?.code === 11000 && e.keyPattern?.orderNumber) || attempt >= 3) throw err;
    }
  }

  // Walk the normal steps, so stock is reserved / taken out exactly like a website order
  const steps: OrderStatus[] =
    input.status === 'delivered' ? ['confirmed', 'shipped', 'delivered'] : input.status === 'confirmed' ? ['confirmed'] : [];
  for (const step of steps) {
    const note = step === 'delivered' && origin === 'store' ? 'Sold in the shop and paid' : undefined;
    order = await updateOrderStatus(String(order._id), step, note, undefined, { by: staffId, silent: true });
  }
  invalidateDashboardCache();
  return order;
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
  // The whole number must match (formats like +212 6…, 00212 6…, 06… are already the same here)
  return left.length >= 8 && left === right;
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
    order.shippingAddress?.city,
    orderItems
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
  if (deposit && order.deposit) {
    deposit.payment = order.deposit.payment;
    deposit.proofs = order.deposit.proofs;
    deposit.methodIds = order.deposit.methodIds;
    deposit.feeCredit = order.deposit.feeCredit;
  }
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

export interface StatusChangeExtra {
  /** Delivery issue code (required for delivery_failed). */
  reason?: DeliveryIssue;
  /** New delivery day, "YYYY-MM-DD" or ISO (required for rescheduled). */
  rescheduledFor?: string;
  /** Staff-only remark kept on the history step. */
  staffNote?: string;
  /** Staff member making the change. */
  by?: string;
  /** No message to the customer (steps of an order entered by staff). */
  silent?: boolean;
}

const DELIVERY_ISSUE_LABEL: Record<DeliveryIssue, string> = {
  customer_unavailable: 'customer unavailable',
  no_answer: 'customer did not answer',
  address_issue: 'address problem',
  refused: 'customer refused the parcel',
  other: 'other reason',
};

/** Orders delivered before `deliveredAt` existed: take the date from their history. */
export function backfillDeliveredAt(order: InstanceType<typeof Order>) {
  if (order.deliveredAt || order.orderStatus !== 'delivered') return;
  const step = [...order.timeline].reverse().find((t) => t.status === 'delivered');
  order.deliveredAt = step?.at || order.updatedAt || new Date();
}

function parseDeliveryDay(value?: string) {
  if (!value) return null;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? storeDayStart(value) : new Date(value);
  return Number.isNaN(day.getTime()) ? null : day;
}

function storeDayLabel(date: Date) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Casablanca', weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

/**
 * Staff (or the customer cancelling) move an order to its next status. Only moves listed in
 * ORDER_TRANSITIONS are accepted. Side effects, each at most once per order:
 * - confirmed: stock reserved (available → reserved)
 * - shipped: stock leaves the store (reserved → out)
 * - cancelled (before shipping): reservation released, coupon use given back
 * - delivered: cash collected (paymentStatus paid, deliveredAt)
 * Refunds and returned units are never touched here: they have their own records.
 */
export async function updateOrderStatus(
  orderId: string,
  orderStatus: OrderStatus,
  note?: string,
  adminNote?: string,
  extra: StatusChangeExtra = {}
) {
  // unitCost is loaded so saving the lines (serials picked on reserve) keeps it
  const order = await Order.findById(orderId).select('+items.unitCost');
  if (!order) throw new ApiError(404, 'Order not found');

  const prev = order.orderStatus;
  const rescheduledFor = parseDeliveryDay(extra.rescheduledFor);
  const staffNote = extra.staffNote?.trim() || undefined;
  const newDate =
    orderStatus === 'rescheduled' && rescheduledFor && rescheduledFor.getTime() !== order.rescheduledFor?.getTime();

  // Same status: only the internal note (or a new delivery date) can change; nobody is notified again
  if (prev === orderStatus && !newDate) {
    if (adminNote !== undefined && adminNote !== (order.adminNote || '')) {
      order.adminNote = adminNote;
      await order.save();
    }
    return order;
  }
  if (RECEIPT_STATUSES.includes(orderStatus)) {
    throw new ApiError(400, 'Register the items that came back under "Returned items"; the status updates itself');
  }
  if (prev !== orderStatus && !ORDER_TRANSITIONS[prev].includes(orderStatus)) {
    throw new ApiError(400, `Cannot move an order from ${prev.replace(/_/g, ' ')} to ${orderStatus.replace(/_/g, ' ')}`);
  }
  if (orderStatus === 'delivery_failed' && !(extra.reason && DELIVERY_ISSUES.includes(extra.reason))) {
    throw new ApiError(400, 'Choose why the delivery failed');
  }
  if (orderStatus === 'rescheduled') {
    if (!rescheduledFor) throw new ApiError(400, 'Choose the new delivery date');
    if (rescheduledFor.getTime() < Date.now() - 36 * 60 * 60 * 1000) {
      throw new ApiError(400, 'The new delivery date cannot be in the past');
    }
  }

  if (orderStatus === 'confirmed' && order.deposit && order.deposit.status !== 'received') {
    throw new ApiError(400, 'Mark the deposit as received before confirming this order');
  }

  backfillDeliveredAt(order);
  const now = new Date();

  if (orderStatus === 'confirmed' && !order.stockReserved) {
    await reserveOrderStock(order, extra.by);
    order.stockReserved = true;
  }

  if (orderStatus === 'shipped' && order.stockReserved) {
    await dispatchOrderStock(order, extra.by);
  }

  if (orderStatus === 'cancelled' && order.stockReserved) {
    await releaseOrderStock(order, 'cancelled', extra.by);
    order.stockReserved = false;
  }

  if (orderStatus === 'delivered') {
    // Cash is collected once; a withdrawn return request does not collect it again
    if (!order.deliveredAt) order.deliveredAt = now;
    if (order.paymentStatus === 'pending' || order.paymentStatus === 'failed') order.paymentStatus = 'paid';
    order.deliveryIssue = undefined;
    order.rescheduledFor = undefined;
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

  if (orderStatus === 'no_answer') {
    order.contactAttempts.push({ channel: 'call', outcome: 'no_answer', note: staffNote, at: now, by: extra.by as never });
  }

  if (orderStatus === 'delivery_failed') {
    order.deliveryIssue = { reason: extra.reason!, note: staffNote, at: now };
    order.deliveryAttempts = (order.deliveryAttempts || 0) + 1;
    order.rescheduledFor = undefined;
  }

  if (orderStatus === 'rescheduled') {
    order.rescheduledFor = rescheduledFor!;
  }

  const dayLabel = rescheduledFor ? storeDayLabel(rescheduledFor) : '';
  const defaultNote =
    orderStatus === 'delivery_failed'
      ? `Delivery attempt failed: ${DELIVERY_ISSUE_LABEL[extra.reason!]}`
      : orderStatus === 'rescheduled'
        ? `Delivery rescheduled to ${dayLabel}`
        : `Status changed to ${orderStatus.replace(/_/g, ' ')}`;

  order.orderStatus = orderStatus;
  order.timeline.push({
    status: orderStatus,
    note: note?.trim() || defaultNote,
    reason: extra.reason,
    staffNote,
    at: now,
    by: extra.by as never,
  });
  if (adminNote !== undefined) order.adminNote = adminNote;
  await order.save();

  invalidateDashboardCache();

  if (extra.silent) return order;

  const copy = statusNotificationCopy(orderStatus);
  if (copy) {
    try {
      await Notification.create({
        user: order.user,
        type: 'order',
        title: copy.title,
        message: `${copy.customerLine}${orderStatus === 'rescheduled' ? ` New date: ${dayLabel}.` : ''} (${order.orderNumber})`,
        link: `/account/orders/${order.orderNumber}`,
      });
    } catch (error) {
      console.error('Order status notification failed', error);
    }
  }

  waitUntil(
    notifyOrderStatusChanged(order, orderStatus)
      .then((sent) => (sent ? recordEmailSent(String(order._id), orderStatus) : undefined))
      .catch((error) => {
        console.error('Order status email failed', error);
      })
  );

  return order;
}

/** Audit step written only after the email provider accepted the message. */
export async function recordEmailSent(orderId: string, status: OrderStatus) {
  await Order.updateOne(
    { _id: orderId },
    {
      $push: {
        timeline: { status, note: `Email sent to the customer (${status.replace(/_/g, ' ')})`, internal: true, at: new Date() },
      },
    }
  );
}

export const CONTACT_CHANNELS = ['call', 'whatsapp', 'sms', 'email'] as const;
export const CONTACT_OUTCOMES = ['reached', 'no_answer', 'busy', 'wrong_number', 'switched_off', 'message_sent'] as const;

/** Staff log a call / message to the customer. Does not change the status. */
export async function logContactAttempt(
  orderId: string,
  input: { channel: (typeof CONTACT_CHANNELS)[number]; outcome: (typeof CONTACT_OUTCOMES)[number]; note?: string },
  by?: string
) {
  const res = await Order.updateOne(
    { _id: orderId },
    {
      $push: {
        contactAttempts: { channel: input.channel, outcome: input.outcome, note: input.note?.trim() || undefined, at: new Date(), by },
      },
    }
  );
  if (!res.matchedCount) throw new ApiError(404, 'Order not found');
  invalidateDashboardCache();
  return getOrderById(orderId);
}

/** What the customer may see of an order: no staff notes, contact log, audit steps or staff ids. */
export function customerOrderView<T>(order: T): T {
  if (!order || typeof order !== 'object') return order;
  const doc = order as unknown as { toObject?: () => Record<string, unknown> };
  const o: Record<string, unknown> = typeof doc.toObject === 'function' ? doc.toObject() : { ...(order as Record<string, unknown>) };
  delete o.adminNote;
  delete o.contactAttempts;
  delete o.receiptTokenHash;
  if (o.deposit && typeof o.deposit === 'object') {
    const dep = o.deposit as Record<string, unknown>;
    if (Array.isArray(dep.proofs)) {
      o.deposit = { ...dep, proofs: (dep.proofs as Record<string, unknown>[]).map(({ addedByName: _n, ...p }) => p) };
    }
  }
  if (o.deliveryIssue && typeof o.deliveryIssue === 'object') {
    const { note: _note, ...issue } = o.deliveryIssue as Record<string, unknown>;
    o.deliveryIssue = issue;
  }
  if (Array.isArray(o.items)) {
    o.items = (o.items as Record<string, unknown>[]).map(({ unitCost: _cost, ...rest }) => rest);
  }
  if (Array.isArray(o.timeline)) {
    o.timeline = (o.timeline as Record<string, unknown>[])
      .filter((t) => !t.internal)
      .map(({ staffNote: _note, by: _by, internal: _internal, ...rest }) => rest);
  }
  if (Array.isArray(o.refunds)) {
    o.refunds = (o.refunds as Record<string, unknown>[]).map(({ by: _by, ...rest }) => rest);
  }
  return o as T;
}

/**
 * Staff: set the deposit on a pending order (amount 0 removes it) and/or mark it received.
 * Changing the amount resets it to "awaiting".
 */
export async function setOrderDeposit(
  orderId: string,
  input: {
    amount?: number;
    received?: boolean;
    payment?: { methodId: string; payerName?: string; reference?: string; note?: string };
    methodIds?: string[];
    feeCredit?: number;
  }
) {
  const order = await Order.findById(orderId);
  if (!order) throw new ApiError(404, 'Order not found');
  const changesDeposit = input.amount !== undefined || input.received !== undefined;
  if (changesDeposit && order.orderStatus !== 'pending' && order.orderStatus !== 'no_answer') {
    throw new ApiError(400, 'The deposit can only be changed while the order is pending');
  }

  const notes: string[] = [];

  // Transfer fees the shop covers: never more than what is left after the deposit
  if (input.feeCredit !== undefined) {
    if (!order.deposit || !(order.deposit.amount > 0)) throw new ApiError(400, 'Set a deposit amount first');
    const max = Math.max(0, order.pricing.total - order.deposit.amount);
    const fee = roundMoney(Math.min(Math.max(0, input.feeCredit), max));
    if (fee !== order.deposit.feeCredit) {
      order.deposit.feeCredit = fee;
      notes.push(fee ? `Transfer fees covered: ${formatDh(fee)} (collect ${formatDh(dueOnDelivery(order))} on delivery)` : 'Transfer fees no longer covered');
    }
  }

  // Which of your payment options this customer sees
  if (input.methodIds !== undefined) {
    if (!order.deposit) throw new ApiError(400, 'Set a deposit amount first');
    const known = new Set(((await getSettings()).depositMethods ?? []).map((m) => m.id));
    order.deposit.methodIds = [...new Set(input.methodIds)].filter((id) => known.has(id));
    notes.push('Payment options shown to the customer updated');
  }

  // How it was paid (staff record): kept with the deposit, receipt photo from the customer kept too
  if (input.payment) {
    if (!order.deposit || !(order.deposit.amount > 0)) throw new ApiError(400, 'Set a deposit amount first');
    const methods = (await getSettings()).depositMethods ?? [];
    const method = methods.find((m) => m.id === input.payment!.methodId);
    if (!method && input.payment.methodId !== 'other') throw new ApiError(400, 'Choose how it was paid');
    const methodName = method?.name || (method ? method.type : 'Other');
    order.deposit.payment = {
      methodId: method?.id ?? 'other',
      methodName,
      payerName: input.payment.payerName?.trim() || undefined,
      reference: input.payment.reference?.trim() || undefined,
      note: input.payment.note?.trim() || undefined,
      hasReceipt: Boolean(order.deposit.payment?.hasReceipt),
      reportedAt: new Date(),
      source: 'staff',
    };
    notes.push(`Deposit payment recorded: ${methodName}${input.payment.payerName ? ` · paid by ${input.payment.payerName.trim()}` : ''}`);
  }
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
      order.deposit = { amount, source: 'admin', status: 'pending', payment: order.deposit?.payment, proofs: order.deposit?.proofs, methodIds: order.deposit?.methodIds, feeCredit: order.deposit?.feeCredit };
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
    order.timeline.push({ status: order.orderStatus, note, at: new Date() });
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
export function amountPaidOnOrder(order: {
  orderStatus: OrderStatus;
  deliveredAt?: Date | null;
  pricing: { total: number };
  deposit?: { amount: number; status: string; feeCredit?: number } | null;
}) {
  // Delivered: the deposit plus what the courier collected (fees the shop covered are not paid)
  if (wasDelivered(order)) return roundMoney(order.pricing.total - feeCreditOf(order.deposit));
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
  const order = await Order.findById(orderId).select('+items.unitCost');
  if (!order) throw new ApiError(404, 'Order not found');
  backfillDeliveredAt(order);

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
  // Only money actually given back marks the payment refunded (all of it, on a delivered order)
  if (wasDelivered(order) && alreadyRefunded + amount >= paid - 0.005) {
    order.paymentStatus = 'refunded';
  }
  order.timeline.push({
    status: order.orderStatus,
    note: `Refund of ${formatDh(amount)} recorded${input.itemsReturned ? ' (items returned)' : ''}: ${input.reason.trim()}`,
    at: new Date(),
    by: actorId as never,
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
  if (order.orderStatus !== 'pending' && order.orderStatus !== 'no_answer') {
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

/** UTC instant of 00:00 on `day` ("YYYY-MM-DD") in the store's timezone (Morocco). */
function storeDayStart(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  // Offset of the store timezone at that moment (handles Morocco's Ramadan change)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Casablanca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess - (wall - guess));
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function listAllOrders(
  page = 1,
  limit = 20,
  status?: string,
  q?: string,
  range: { from?: string; to?: string } = {},
  sort?: string,
  deposit?: string,
  origin?: string
) {
  const filter: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];
  const fromOrigin = originFilter(origin);
  if (fromOrigin) and.push(fromOrigin);
  const order: Record<string, 1 | -1> =
    sort === 'oldest'
      ? { createdAt: 1 }
      : sort === 'total_desc'
        ? { 'pricing.total': -1, createdAt: -1 }
        : sort === 'total_asc'
          ? { 'pricing.total': 1, createdAt: -1 }
          : { createdAt: -1 };
  // A status, a group of statuses ("group:returns") or "attention"
  if (status === 'attention') and.push(attentionFilter());
  else if (status?.startsWith('group:') && ORDER_STATUS_GROUPS.includes(status.slice(6) as OrderStatusGroup)) {
    filter.orderStatus = { $in: statusesInGroup(status.slice(6) as OrderStatusGroup) };
  } else if (status && (ORDER_STATUSES as readonly string[]).includes(status)) filter.orderStatus = status;
  if (q?.trim()) {
    const rx = new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    // Order number, or the customer's name / phone on the delivery address
    and.push({
      $or: [
        { orderNumber: rx },
        { 'shippingAddress.fullName': rx },
        { 'shippingAddress.phone': rx },
        { 'deposit.payment.payerName': rx },
        { 'deposit.payment.reference': rx },
      ],
    });
  }
  // Deposits: due (nothing sent), reported (sent, to check), paid, or any order with a deposit
  if (deposit === 'any') and.push({ 'deposit.amount': { $gt: 0 } });
  else if (deposit === 'paid') and.push({ 'deposit.amount': { $gt: 0 }, 'deposit.status': 'received' });
  else if (deposit === 'reported' || deposit === 'due') {
    and.push({
      'deposit.amount': { $gt: 0 },
      'deposit.status': 'pending',
      orderStatus: { $in: ['pending', 'no_answer'] },
      'deposit.payment': { $exists: deposit === 'reported' },
    });
  }
  if (and.length) filter.$and = and;
  // Placed between two calendar days (inclusive), Morocco time
  const createdAt: Record<string, Date> = {};
  if (range.from && DAY_RE.test(range.from)) createdAt.$gte = storeDayStart(range.from);
  if (range.to && DAY_RE.test(range.to)) {
    const next = new Date(storeDayStart(range.to).getTime() + 36 * 60 * 60 * 1000);
    createdAt.$lt = storeDayStart(next.toISOString().slice(0, 10));
  }
  if (Object.keys(createdAt).length) filter.createdAt = createdAt;
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort(order)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('user', 'name email')
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

export async function getOrderById(id: string) {
  const order = await Order.findById(id)
    .populate('user', 'name email phone source')
    .populate('timeline.by', 'name')
    .populate('contactAttempts.by', 'name')
    .populate('refunds.by', 'name');
  if (!order) throw new ApiError(404, 'Order not found');
  return order;
}

const DELETABLE_STATUSES: OrderStatus[] = ['pending', 'no_answer', 'confirmed', 'cancelled'];

/**
 * Why staff may not delete this order (null = they may): once money moved or the parcel left,
 * deleting would erase a real sale from revenue, profit and the customer's history — cancel it
 * instead. The owner can still delete any order (test orders…).
 */
export function orderDeleteBlock(order: {
  orderStatus: OrderStatus;
  deliveredAt?: Date | null;
  stockDispatched?: boolean;
  paymentStatus?: string;
  deposit?: { status?: string } | null;
  refunds?: unknown[];
}): string | null {
  if (wasDelivered(order)) return 'This order was delivered';
  if (order.stockDispatched || !DELETABLE_STATUSES.includes(order.orderStatus)) return 'This order has already been shipped';
  if (order.deposit?.status === 'received') return 'A deposit was received for this order';
  if (order.paymentStatus === 'paid') return 'This order is paid';
  if (order.refunds?.length) return 'This order has refunds';
  return null;
}

export async function deleteOrder(id: string, opts: { isOwner?: boolean } = {}) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, 'Order not found');
  const order = await Order.findById(id);
  if (!order) throw new ApiError(404, 'Order not found');

  const blocked = opts.isOwner ? null : orderDeleteBlock(order);
  if (blocked) throw new ApiError(403, `${blocked}, so only the owner can delete it.`);

  if (order.stockReserved && !order.stockDispatched) {
    await releaseOrderStock(order, 'order deleted');
    order.stockReserved = false;
  }

  if (order.coupon?.couponId && order.orderStatus !== 'cancelled') {
    await Coupon.updateOne(
      { _id: order.coupon.couponId, usedCount: { $gt: 0 } },
      { $inc: { usedCount: -1 } }
    );
  }

  await Order.deleteOne({ _id: order._id });
  // Private payment photos of this order go with it
  await Promise.all([DepositProof.deleteMany({ order: order._id }), DepositReceipt.deleteMany({ order: order._id })]);
  await Notification.deleteMany({
    $or: [
      { link: `/account/orders/${order.orderNumber}` },
      { link: `/admin/orders/${order._id}` },
      { message: new RegExp(order.orderNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) },
    ],
  });

  invalidateDashboardCache();
}

/**
 * The payment options a customer may see for an order: only while its deposit is awaited, only
 * the visible ones, and only those staff chose for this order (none chosen = all visible).
 */
export function paymentOptionsFor(
  order: { orderStatus: string; deposit?: { amount: number; status: string; methodIds?: string[] } | null },
  settings: { depositMethods?: DepositMethod[]; depositInstructions?: string }
) {
  const d = order.deposit;
  if (!d || !(d.amount > 0) || d.status !== 'pending' || !['pending', 'no_answer'].includes(order.orderStatus)) return null;
  const chosen = new Set(d.methodIds ?? []);
  const methods = (settings.depositMethods ?? []).filter((m) => m.visible !== false && (!chosen.size || chosen.has(m.id)));
  return { methods, instructions: settings.depositInstructions?.trim() || '' };
}

/** Customer view of an order plus, when a deposit is awaited, the payment details to use. */
export async function customerOrderViewWithPayment<T>(order: T): Promise<T> {
  const view = customerOrderView(order) as unknown as Record<string, unknown> & {
    orderStatus: string;
    deposit?: { amount: number; status: string; methodIds?: string[] } & Record<string, unknown>;
  };
  if (!view?.deposit) return view as unknown as T;
  const options = paymentOptionsFor(view, await getSettings());
  const { methodIds: _ids, ...deposit } = view.deposit;
  return { ...view, deposit: options ? { ...deposit, paymentOptions: options } : deposit } as unknown as T;
}
