import { Response } from 'express';
import { AuthRequest } from '../types/express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendPaginated, sendSuccess } from '../utils/ApiResponse';
import { param } from '../utils/params';
import { hasPermission } from '../permissions';
import * as ops from '../services/inventoryOps.service';
import * as reports from '../services/inventoryReports.service';

const actor = (req: AuthRequest) => ({
  id: req.user!.userId,
  canApprove: hasPermission(req.user!.role, 'inventory:approve'),
});

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 80) : undefined);
const num = (v: unknown) => (typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined);
const day = (v: unknown, end = false) =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T${end ? '23:59:59.999' : '00:00:00.000'}Z`) : undefined;

export const overview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = req.query;
  const sort = ['name', 'available', 'physical', 'value', 'nonSellable'].includes(String(q.sort)) ? (q.sort as reports.InventoryQuery['sort']) : undefined;
  const result = await reports.inventoryOverview({
    page: num(q.page), limit: num(q.limit), q: str(q.q), serial: str(q.serial), condition: str(q.condition),
    location: str(q.location), supplier: str(q.supplier), status: str(q.status), sort, dir: q.dir === 'asc' ? 'asc' : 'desc',
  });
  sendPaginated(res, result.items, { page: result.page, limit: result.limit, total: result.total });
});

export const summary = asyncHandler(async (_req: AuthRequest, res: Response) => {
  sendSuccess(res, await reports.inventorySummary());
});

export const product = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await reports.productInventory(param(req, 'id')));
});

export const createListing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const listing = await ops.createConditionListing(param(req, 'id'), req.body.condition, req.body.price);
  sendSuccess(res, listing, 'Listing ready — set its price and activate it', 201);
});

export const move = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ops.changeCondition(req.body, actor(req));
  sendSuccess(res, await reports.productInventory(req.body.productId), 'Stock updated');
});

export const adjust = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ops.adjustStock(req.body, actor(req));
  sendSuccess(res, await reports.productInventory(req.body.productId), 'Stock adjusted');
});

export const registerSerials = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await ops.registerSerials(req.body, actor(req)), 'Serial numbers registered');
});

export const receipts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await reports.listReceipts({ page: num(req.query.page), limit: num(req.query.limit), supplier: str(req.query.supplier) });
  sendPaginated(res, r.items, { page: r.page, limit: r.limit, total: r.total });
});

export const receive = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await ops.receiveDelivery(req.body, actor(req)), 'Delivery recorded', 201);
});

export const returns = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await reports.listReturns({ page: num(req.query.page), limit: num(req.query.limit), status: str(req.query.status) });
  sendPaginated(res, r.items, { page: r.page, limit: r.limit, total: r.total });
});

export const returnDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await reports.getReturn(param(req, 'id')));
});

export const createReturn = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await ops.createReturn({ ...req.body, orderId: param(req, 'id') }, actor(req)), 'Return registered', 201);
});

export const assessReturn = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ops.assessReturn(param(req, 'id'), req.body, actor(req));
  sendSuccess(res, await reports.getReturn(param(req, 'id')), 'Return updated');
});

export const repairs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await reports.listRepairs({ page: num(req.query.page), limit: num(req.query.limit), status: str(req.query.status), open: str(req.query.open) });
  sendPaginated(res, r.items, { page: r.page, limit: r.limit, total: r.total });
});

export const repairDetail = asyncHandler(async (req: AuthRequest, res: Response) => {
  sendSuccess(res, await reports.getRepair(param(req, 'id')));
});

export const updateRepair = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ops.updateRepair(param(req, 'id'), req.body, actor(req));
  sendSuccess(res, await reports.getRepair(param(req, 'id')), 'Repair updated');
});

export const completeRepair = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ops.completeRepair(param(req, 'id'), req.body, actor(req));
  sendSuccess(res, await reports.getRepair(param(req, 'id')), 'Quality check recorded');
});

export const movements = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await reports.listMovements({
    page: num(req.query.page), limit: num(req.query.limit), product: str(req.query.product), type: str(req.query.type),
    from: day(req.query.from), to: day(req.query.to, true),
  });
  sendPaginated(res, r.items, { page: r.page, limit: r.limit, total: r.total });
});
