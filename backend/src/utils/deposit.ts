import { ApiError } from './ApiError';

export type DepositType = 'fixed' | 'percent';

/** Per-product upfront deposit: a fixed amount per unit, or a percentage of the line price. */
export interface ProductDepositRule {
  type: DepositType;
  value: number;
}

export const roundMoney = (n: number) => Math.round(n * 100) / 100;

/**
 * Deposit owed for `qty` units of a product; 0 when the product has no rule.
 * Never more than the line total. Mirrored in frontend/src/lib/deposit.ts.
 */
export function lineDeposit(
  rule: ProductDepositRule | null | undefined,
  price: number,
  qty: number
): number {
  if (!rule || !(rule.value > 0)) return 0;
  const lineTotal = price * qty;
  const raw =
    rule.type === 'percent' ? (lineTotal * Math.min(rule.value, 100)) / 100 : rule.value * qty;
  return roundMoney(Math.min(raw, lineTotal));
}

/** Validates a deposit rule from admin input; returns null for "no deposit". */
export function sanitizeDepositRule(input: unknown): ProductDepositRule | null {
  if (!input || typeof input !== 'object') return null;
  const { type, value } = input as Record<string, unknown>;
  const amount = Number(value);
  if ((type !== 'fixed' && type !== 'percent') || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  if (type === 'percent' && amount > 100) {
    throw new ApiError(400, 'Deposit percentage must be 100 or less');
  }
  return { type, value: roundMoney(amount) };
}

type DepositLike =
  | { amount: number; status?: string; feeCredit?: number | null; payment?: { fee?: number | null } | null }
  | null
  | undefined;

/**
 * Transfer fees the shop covers: only what staff set. The fee the customer types when reporting
 * their payment is information for staff, never taken off by itself (a customer could otherwise
 * type any "fee" and bring the amount the courier collects down to 0).
 */
function coveredFees(deposit: DepositLike) {
  if (!deposit) return 0;
  return Math.max(0, typeof deposit.feeCredit === 'number' ? deposit.feeCredit : 0);
}

/** Transfer fees the shop covers for the customer (only once the deposit is received). */
export function feeCreditOf(deposit: DepositLike) {
  return deposit && deposit.status === 'received' ? coveredFees(deposit) : 0;
}

/**
 * What the courier collects: the order total minus the deposit and the transfer fees the shop
 * covers, never below 0 — so the customer never pays more than the order in total.
 * Before the deposit arrives this is what will be left once it is paid.
 */
export function dueOnDelivery(order: { pricing: { total: number }; deposit?: DepositLike }) {
  const d = order.deposit;
  const deposit = d && d.amount > 0 ? d.amount : 0;
  return roundMoney(Math.max(0, order.pricing.total - deposit - coveredFees(d)));
}
