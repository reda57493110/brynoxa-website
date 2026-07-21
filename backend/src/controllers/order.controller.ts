import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendPaginated } from '../utils/ApiResponse';
import * as orderService from '../services/order.service';
import { param } from '../utils/params';

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.createCodOrder({
    userId: req.user!.userId,
    items: req.body.items,
    shippingAddress: req.body.shippingAddress,
    couponCode: req.body.couponCode,
    customerNote: req.body.customerNote,
  });
  sendSuccess(res, order, 'Order placed', 201);
});

export const myOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const result = await orderService.listUserOrders(req.user!.userId, page, limit);
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const myOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getUserOrder(req.user!.userId, param(req, 'orderNumber'));
  sendSuccess(res, order);
});

export const validateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const { coupon, discount } = await orderService.validateCoupon(req.body.code, req.body.subtotal);
  sendSuccess(res, {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
  });
});

export const adminOrders = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const status = req.query.status as string | undefined;
  const result = await orderService.listAllOrders(page, limit, status);
  sendPaginated(res, result.items, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const adminOrder = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.getOrderById(param(req, 'id'));
  sendSuccess(res, order);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const order = await orderService.updateOrderStatus(
    param(req, 'id'),
    req.body.orderStatus,
    req.body.note,
    req.body.adminNote
  );
  sendSuccess(res, order, 'Order updated');
});
