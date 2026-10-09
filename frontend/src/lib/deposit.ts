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
