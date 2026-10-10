import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/ApiResponse';
import { param } from '../utils/params';
import { hasPermission } from '../permissions';
import {
  customerProfile,
  customerSummary,
  exportCustomersCsv,
  listCustomerOverview,
  type CustomerListQuery,
} from '../services/customerAnalytics.service';
import { updateCustomer } from '../services/customerAdmin.service';
import { applyForWholesale, getMyWholesale, getWholesaleTerms, reviewWholesale } from '../services/wholesale.service';
import { recordRefund } from '../services/order.service';

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

export const exportCsv = asyncHandler(async (req: AuthRequest, res: Response) => {
  const csv = await exportCustomersCsv(parseCustomerQuery(req.query), canSeeProfit(req));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="brynoxa-customers-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(`﻿${csv}`);
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

export const refund = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await recordRefund(param(req, 'id'), req.body, req.user!.userId);
  sendSuccess(res, order, 'Refund recorded');
});

/** Customer side: wholesale status, application, and the pricing checkout should show. */
export const myWholesale = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await getMyWholesale(req.user!.userId));
});

export const applyWholesale = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await applyForWholesale(req.user!.userId, req.body), 'Application sent');
});

export const myPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, { terms: await getWholesaleTerms(req.user?.userId) });
});
