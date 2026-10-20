import type { ProductDeposit } from '@/types'

const roundMoney = (n: number) => Math.round(n * 100) / 100

/** Deposit owed for `qty` units; matches backend lineDeposit in utils/deposit.ts. */
export function lineDeposit(rule: ProductDeposit | null | undefined, price: number, qty: number): number {
  if (!rule || !(rule.value > 0)) return 0
  const lineTotal = price * qty
  const raw = rule.type === 'percent' ? (lineTotal * Math.min(rule.value, 100)) / 100 : rule.value * qty
  return roundMoney(Math.min(raw, lineTotal))
}

/** Order deposit from its lines, capped at the order total (as the backend does). */
export function orderDeposit(
  lines: { rule: ProductDeposit | null | undefined; price: number; qty: number }[],
  total: number
): number {
  const sum = lines.reduce((acc, line) => acc + lineDeposit(line.rule, line.price, line.qty), 0)
  return roundMoney(Math.min(sum, total))
}

type WithDeposit = { pricing: { total: number }; deposit?: { amount: number; status?: string; feeCredit?: number } | null }

/** Transfer fees the shop covers for this order (0 when none). */
export function feesCovered(order: WithDeposit) {
  return Math.max(0, order.deposit?.feeCredit ?? 0)
}

/**
 * What is paid on delivery: total minus the deposit and the fees the shop covers, never below 0 —
 * the customer never pays more than the order in total. Same as backend dueOnDelivery.
 */
export function dueOnDelivery(order: WithDeposit) {
  const deposit = order.deposit && order.deposit.amount > 0 ? order.deposit.amount : 0
  return roundMoney(Math.max(0, order.pricing.total - deposit - feesCovered(order)))
}

/** What the courier collects right now: the full total until the deposit is received. */
export function toCollect(order: WithDeposit) {
  return order.deposit?.status === 'received' ? dueOnDelivery(order) : order.pricing.total
}
