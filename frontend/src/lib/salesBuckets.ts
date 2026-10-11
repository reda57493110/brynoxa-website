import type { SalesAnalytics } from '@/types'

type Day = SalesAnalytics['series'][number]

/** One bar: a day, or a week when the period is long. */
export interface SalesBucket {
  from: string
  to: string
  revenue: number
  sales: number
  orders: number
}

/** "2026-10-07" → Date at noon UTC, so formatting never shifts the calendar day. */
const asDate = (day: string) => new Date(`${day}T12:00:00Z`)
export const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(asDate(day))

export const dayLabel = (day: string) => fmtDay(day, { day: 'numeric', month: 'short' })

/** Bucket label: "7 Oct" for a day, "6–12 Oct" / "29 Sep–5 Oct" for a week. */
export function bucketLabel(b: Pick<SalesBucket, 'from' | 'to'>) {
  if (b.from === b.to) return dayLabel(b.from)
  const sameMonth = b.from.slice(0, 7) === b.to.slice(0, 7)
  return sameMonth ? `${fmtDay(b.from, { day: 'numeric' })}–${dayLabel(b.to)}` : `${dayLabel(b.from)}–${dayLabel(b.to)}`
}

/** Daily up to a month; weekly (7-day groups, the last one ending today) beyond that. */
export function toBuckets(series: Day[]): SalesBucket[] {
  if (series.length <= 31) {
    return series.map((d) => ({ from: d.date, to: d.date, revenue: d.revenue, sales: d.sales, orders: d.orders }))
  }
  const out: SalesBucket[] = []
  // Group from the end so the most recent bar is a full week ending today
  for (let end = series.length; end > 0; end -= 7) {
    const chunk = series.slice(Math.max(0, end - 7), end)
    out.unshift({
      from: chunk[0].date,
      to: chunk[chunk.length - 1].date,
      revenue: chunk.reduce((a, d) => a + d.revenue, 0),
      sales: chunk.reduce((a, d) => a + d.sales, 0),
      orders: chunk.reduce((a, d) => a + d.orders, 0),
    })
  }
  return out
}
