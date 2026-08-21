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

  const order = await orderService.createCodOrder({
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
      { order, user: auth.user, accessToken: auth.accessToken },
      'Order placed',
      201
    );
    return;
  }

  sendSuccess(res, { order }, 'Order placed', 201);
});

export const myOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await orderService.listUserOrders(req.user!.userId, page, limit);
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const myOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.getUserOrder(req.user!.userId, param(req, 'orderNumber'));
  sendSuccess(res, order);
});

export const guestOrderReceipt = asyncHandler(async (req: AuthRequest, res: Response) => {
  const email = String(req.query.email || '');
  const order = await orderService.getGuestOrderReceipt(param(req, 'orderNumber'), email);
  sendSuccess(res, order);
});

export const cancelMyOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.cancelUserOrder(req.user!.userId, param(req, 'orderNumber'));
  sendSuccess(res, order, 'Order cancelled');
});

export const updateMyOrderItems = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await orderService.updateUserOrderItems(
    req.user!.userId,
    param(req, 'orderNumber'),
    req.body.items
  );
  sendSuccess(res, order, 'Order updated');
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
  const result = await orderService.listAllOrders(page, limit, status, q);
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
    req.body.adminNote
  );
  sendSuccess(res, order, 'Order updated');
});
