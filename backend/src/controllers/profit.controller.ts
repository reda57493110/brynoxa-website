import { Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/ApiResponse';
import { param } from '../utils/params';
import { AuthRequest } from '../types/express';
import { SALES_RANGES, type SalesRange } from '../services/dashboard.service';
import * as profit from '../services/profit.service';

const rangeOf = (raw: unknown, fallback: SalesRange): SalesRange => {
  const n = Number(raw);
  return (SALES_RANGES as readonly number[]).includes(n) ? (n as SalesRange) : fallback;
};

/** Admin → Profit for the chosen period. */
export const report = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await profit.profitReport(rangeOf(req.query.days, 30)));
});

/** Net profit now vs the period before (dashboard card). */
export const summary = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await profit.profitSummary(rangeOf(req.query.days, 14)));
});

export const orderCosts = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await profit.setOrderCosts(param(req, 'id'), req.body ?? {}), 'Order costs saved');
});

export const courierCosts = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await profit.setCourierCosts(req.body ?? {}), 'Courier prices saved');
});

export const productCost = asyncHandler(async (req: AuthRequest, res: Response) => {
  const body = req.body ?? {};
  const r = await profit.setProductCost(param(req, 'id'), body.costPrice, body.applyToPastOrders !== false);
  sendSuccess(res, r, 'Cost price saved');
});

export const addExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await profit.addExpense(req.body ?? {}, req.user?.userId), 'Expense added');
});

export const deleteExpense = asyncHandler(async (req: AuthRequest, res: Response) => {
  await profit.deleteExpense(param(req, 'id'));
  sendSuccess(res, null, 'Expense deleted');
});
