const roundMoney = (n: number) => Math.round(n * 100) / 100

/** Unit price after a wholesale tier discount; matches backend utils/wholesale.ts. */
export function wholesaleUnitPrice(listPrice: number, discountPercent: number) {
  const pct = Math.min(Math.max(discountPercent, 0), 90)
  return roundMoney(listPrice * (1 - pct / 100))
}
