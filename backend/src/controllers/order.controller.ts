import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/ApiResponse';
import * as orderService from '../services/order.service';
import * as authService from '../services/auth.service';
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
  sendSuccess(res, orderService.customerOrderView(order));
});

export const guestOrderReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const receiptToken = String(req.body.token || '');
  const order = await orderService.getGuestOrderReceipt(param(req, 'orderNumber'), receiptToken);
  sendSuccess(res, orderService.customerOrderView(order));
});

export const trackGuestOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.trackGuestOrder(req.body.orderNumber, req.body.phone);
  sendSuccess(res, orderService.customerOrderView(order));
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
  const { coupon, discount } = await orderService.validateCoupon(req.body.code, req.body.subtotal);
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
  const result = await orderService.listAllOrders(page, limit, status, q, { from, to });
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
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
  await orderService.deleteOrder(param(req, 'id'));
  sendSuccess(res, null, 'Order deleted');
});
