import { hideCostsFor } from '../utils/hideCosts';
import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/ApiResponse';
import { param } from '../utils/params';
import { hasPermission } from '../permissions';
import {
  customerProfile,
  customerSummary,
  customerExportTable,
  exportCustomersCsv,
  exportCustomersXlsx,
  listCustomerOverview,
  type CustomerListQuery,
} from '../services/customerAnalytics.service';
import { updateCustomer } from '../services/customerAdmin.service';
import { getMyWholesale, getWholesaleTerms, reviewWholesale } from '../services/wholesale.service';
import { getOrderById, recordRefund } from '../services/order.service';
import { returnAndRefund } from '../services/returnRefund.service';

/** Cost and profit figures need the "reports" permission (owner/admin by default). */
const canSeeProfit = (req: AuthRequest) => hasPermission(req.user?.role, 'reports');

function date(value: unknown, endOfDay = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function str(value: unknown, max = 80) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function numberParam(value: unknown) {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Query-string → validated list filters (unknown values are ignored). */
export function parseCustomerQuery(q: Record<string, unknown>): CustomerListQuery {
  const pick = <T extends string>(v: unknown, allowed: readonly T[]) =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
  return {
    page: numberParam(q.page),
    limit: numberParam(q.limit),
    q: str(q.q),
    type: pick(q.type, ['retail', 'wholesale', 'business'] as const),
    status: pick(q.status, ['active', 'disabled', 'unverified', 'wholesale-pending'] as const),
    registeredFrom: date(q.registeredFrom),
    registeredTo: date(q.registeredTo, true),
    from: date(q.from),
    to: date(q.to, true),
    activity: pick(q.activity, ['ordered', 'never', 'active', 'inactive'] as const),
    minOrders: numberParam(q.minOrders),
    maxOrders: numberParam(q.maxOrders),
    minNet: numberParam(q.minNet),
    maxNet: numberParam(q.maxNet),
    minProfit: numberParam(q.minProfit),
    segment: str(q.segment, 24),
    source: str(q.source, 24),
    sort: pick(q.sort, ['spent', 'net', 'profit', 'orders', 'lastOrder', 'registered', 'name'] as const),
    dir: pick(q.dir, ['asc', 'desc'] as const),
  };
}

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await listCustomerOverview(parseCustomerQuery(req.query), canSeeProfit(req));
  sendPaginated(res, result.items, { page: result.page, limit: result.limit, total: result.total });
});

export const summary = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await customerSummary(date(req.query.from), date(req.query.to, true), canSeeProfit(req)));
});

/** Customers → Export: Excel (default), the table for the printable list (json), or CSV. */
export const exportCsv = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = parseCustomerQuery(req.query);
  const day = new Date().toISOString().slice(0, 10);
  res.setHeader('Cache-Control', 'no-store');
  if (req.query.format === 'json') {
    sendSuccess(res, await customerExportTable(query, canSeeProfit(req)));
    return;
  }
  if (req.query.format === 'csv') {
    const csv = await exportCustomersCsv(query, canSeeProfit(req));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="brynoxa-customers-${day}.csv"`);
    res.send(`\uFEFF${csv}`);
    return;
  }
  const file = await exportCustomersXlsx(query, canSeeProfit(req));
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="brynoxa-customers-${day}.xlsx"`);
  res.send(file);
});

export const profile = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await customerProfile(param(req, 'id'), canSeeProfit(req), date(req.query.from), date(req.query.to, true)));
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  await updateCustomer(param(req, 'id'), req.body, req.user!.userId);
  sendSuccess(res, await customerProfile(param(req, 'id'), canSeeProfit(req)), 'Customer updated');
});

export const review = asyncHandler(async (req: AuthRequest, res: Response) => {
  await reviewWholesale(param(req, 'id'), req.body, req.user!.userId);
  sendSuccess(res, await customerProfile(param(req, 'id'), canSeeProfit(req)), 'Wholesale account updated');
});

/** Admin → order → "Return & refund" */
export const returnRefund = asyncHandler(async (req: AuthRequest, res: Response) => {
  await returnAndRefund(param(req, 'id'), req.body, {
    id: req.user!.userId,
    canApprove: hasPermission(req.user!.role, 'inventory:approve'),
  });
  const order = await getOrderById(param(req, 'id'));
  sendSuccess(res, hideCostsFor(req.user?.role, order), 'Return and refund recorded');
});

export const refund = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await recordRefund(param(req, 'id'), req.body, req.user!.userId);
  sendSuccess(res, hideCostsFor(req.user?.role, order), 'Refund recorded');
});

/** Customer side: wholesale status, application, and the pricing checkout should show. */
export const myWholesale = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await getMyWholesale(req.user!.userId));
});

/** Wholesale and business accounts are set up by staff (Admin → Customers), not requested by customers. */
export const myPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { terms: await getWholesaleTerms(req.user?.userId) });
});
