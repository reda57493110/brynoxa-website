import { hideCostsFor } from '../utils/hideCosts';
import { getSettings, sanitizeDepositMethods } from '../models/Settings';
import { stampPaymentDetailsChange } from '../utils/paymentDetailsAudit';
import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/ApiResponse';
import * as orderService from '../services/order.service';
import * as authService from '../services/auth.service';
import * as depositPayment from '../services/depositPayment.service';
import { param } from '../utils/params';
import { AuthRequest } from '../types/express';

export const createOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const shippingAddress = req.body.shippingAddress;
  const { userId, auth } = await authService.resolveCheckoutCustomer({
    authenticatedUserId: req.user?.userId,
    email: req.body.email,
    name: shippingAddress.fullName,
    phone: shippingAddress.phone,
    password: req.body.password,
    shippingAddress,
  });

  const result = await orderService.createCodOrder({
    userId,
    items: req.body.items,
    shippingAddress,
    couponCode: req.body.couponCode,
    customerNote: req.body.customerNote,
  });

  if (auth) {
    authService.setRefreshCookie(res, auth.refreshToken);
    sendSuccess(
      res,
      { order: orderService.customerOrderView(result.order), user: auth.user, accessToken: auth.accessToken },
      'Order placed',
      201
    );
    return;
  }

  sendSuccess(res, { order: orderService.customerOrderView(result.order), receiptToken: result.receiptToken }, 'Order placed', 201);
});

export const myOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await orderService.listUserOrders(req.user!.userId, page, limit);
  sendPaginated(res, result.items.map(orderService.customerOrderView), {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const myOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.getUserOrder(req.user!.userId, param(req, 'orderNumber'));
  sendSuccess(res, await orderService.customerOrderViewWithPayment(order));
});

export const guestOrderReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const receiptToken = String(req.body.token || '');
  const order = await orderService.getGuestOrderReceipt(param(req, 'orderNumber'), receiptToken);
  sendSuccess(res, await orderService.customerOrderViewWithPayment(order));
});

export const trackGuestOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  // No order number (lost): the short list of orders made with this phone
  if (!req.body.orderNumber) {
    sendSuccess(res, { phoneMatches: await orderService.trackOrdersByPhone(req.body.phone) });
    return;
  }
  const order = await orderService.trackGuestOrder(req.body.orderNumber, req.body.phone);
  sendSuccess(res, await orderService.customerOrderViewWithPayment(order));
});

export const cancelMyOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.cancelUserOrder(req.user!.userId, param(req, 'orderNumber'));
  sendSuccess(res, orderService.customerOrderView(order), 'Order cancelled');
});

export const updateMyOrderItems = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.updateUserOrderItems(
    req.user!.userId,
    param(req, 'orderNumber'),
    req.body.items
  );
  sendSuccess(res, orderService.customerOrderView(order), 'Order updated');
});

export const validateCoupon = asyncHandler(async (req: AuthRequest, res: Response) => {
  const lines = await orderService.couponLinesFor(req.body.items);
  const { coupon, discount } = await orderService.validateCoupon(req.body.code, req.body.subtotal, lines);
  sendSuccess(res, {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
  });
});

export const adminOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  const to = typeof req.query.to === 'string' ? req.query.to : undefined;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : undefined;
  const deposit = typeof req.query.deposit === 'string' ? req.query.deposit : undefined;
  const origin = typeof req.query.origin === 'string' ? req.query.origin : undefined;
  const result = await orderService.listAllOrders(page, limit, status, q, { from, to }, sort, deposit, origin);
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

/** An order from social media, the phone or the shop, entered by staff. */
export const createManualOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.createManualOrder(req.body, req.user!.userId);
  // The new order still holds purchase costs: only for staff allowed to see them
  sendSuccess(res, hideCostsFor(req.user?.role, order), 'Order added', 201);
});

export const adminOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.getOrderById(param(req, 'id'));
  sendSuccess(res, order);
});

export const updateOrderStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.updateOrderStatus(
    param(req, 'id'),
    req.body.orderStatus,
    req.body.note,
    req.body.adminNote,
    { reason: req.body.reason, rescheduledFor: req.body.rescheduledFor, staffNote: req.body.staffNote, by: req.user?.userId }
  );
  sendSuccess(res, await orderService.getOrderById(String(order._id)), 'Order updated');
});

export const logOrderContact = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.logContactAttempt(param(req, 'id'), req.body, req.user?.userId);
  sendSuccess(res, order, 'Contact attempt saved');
});

export const setOrderDeposit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.setOrderDeposit(param(req, 'id'), req.body);
  sendSuccess(res, order, 'Deposit updated');
});

export const deleteOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  await orderService.deleteOrder(param(req, 'id'), { isOwner: req.user?.role === 'admin' });
  sendSuccess(res, null, 'Order deleted');
});

export const reportMyDepositPayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await depositPayment.reportDepositPayment(req.user!.userId, param(req, 'orderNumber'), req.body);
  sendSuccess(res, await orderService.customerOrderViewWithPayment(order), 'Payment details sent');
});

export const depositReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const receipt = await depositPayment.getDepositReceipt(param(req, 'id'));
  res.setHeader('Content-Type', receipt.contentType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(receipt.data);
});

function sendImage(res: Response, image: { data: Buffer; contentType: string }) {
  res.setHeader('Content-Type', image.contentType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(image.data);
}

export const addDepositProof = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await depositPayment.addDepositProof(param(req, 'id'), String(req.body.image || ''), req.user?.userId);
  sendSuccess(res, order, 'Photo added');
});

export const removeDepositProof = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await depositPayment.removeDepositProof(param(req, 'id'), param(req, 'proofId'));
  sendSuccess(res, order, 'Photo deleted');
});

export const depositProofImage = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendImage(res, await depositPayment.getDepositProofImage(param(req, 'id'), param(req, 'proofId')));
});

export const myDepositProofImage = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendImage(res, await depositPayment.getMyDepositProofImage(req.user!.userId, param(req, 'orderNumber'), param(req, 'proofId')));
});

/** Your payment details: order staff can read them (to share with customers); only the owner changes them. */
export const getDepositMethods = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const settings = await getSettings();
  sendSuccess(res, paymentDetailsView(settings));
});

function paymentDetailsView(settings: Awaited<ReturnType<typeof getSettings>>) {
  return {
    depositMethods: settings.depositMethods ?? [],
    depositInstructions: settings.depositInstructions ?? '',
    changedAt: settings.paymentDetailsChangedAt ?? null,
    changedBy: settings.paymentDetailsChangedBy ?? null,
  };
}

export const saveDepositMethods = asyncHandler(async (req: AuthRequest, res: Response) => {
  const settings = await getSettings();
  settings.depositMethods = sanitizeDepositMethods(req.body.depositMethods);
  if (req.body.depositInstructions !== undefined) settings.depositInstructions = String(req.body.depositInstructions).slice(0, 2000);
  await stampPaymentDetailsChange(settings, req.user?.userId);
  await settings.save();
  sendSuccess(res, paymentDetailsView(settings), 'Payment options saved');
});
