import type { ReactNode } from 'react'
import type { CustomerMetrics, SalesBlock } from '@/types'
import { ProfitText, Section } from './shared'
import { money, pct } from './utils'

function Row({ label, children, strong, note }: { label: string; children: ReactNode; strong?: boolean; note?: string }) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-3 border-t border-[var(--border)] py-2 text-sm first:border-t-0">
      <dt className={strong ? 'font-medium' : 'text-[var(--fg-muted)]'}>
        {label}
        {note ? <span className="block text-[11px] font-normal text-[var(--fg-muted)]">{note}</span> : null}
      </dt>
      <dd className={`text-right whitespace-nowrap ${strong ? 'font-semibold' : ''}`}>{children}</dd>
    </div>
  )
}

function Breakdown({ s, shipping }: { s: SalesBlock; shipping?: number }) {
  return (
    <dl>
      <Row label="Gross sales">{money(s.grossSales)}</Row>
      <Row label="Wholesale discount">−{money(s.wholesaleDiscounts)}</Row>
      <Row label="Coupons">−{money(s.couponDiscounts)}</Row>
      <Row label="Refunds">−{money(s.refunds)}</Row>
      <Row label="Net sales" strong>
        {money(s.netSales)}
      </Row>
      <Row label="Product cost">{s.grossProfit === null ? '—' : money(s.cogs)}</Row>
      <Row label="Gross profit" strong>
        <ProfitText value={s.grossProfit} missing={s.ordersMissingCost} />
      </Row>
      <Row label="Margin">
        <ProfitText value={s.margin} missing={0} format={pct} />
      </Row>
      <Row label="Profit / order">
        <ProfitText value={s.profitPerOrder} missing={0} />
      </Row>
      {shipping !== undefined ? (
        <Row label="Shipping" note="not in sales">
          {money(shipping)}
        </Row>
      ) : null}
    </dl>
  )
}

function ChannelCard({ title, s }: { title: string; s: SalesBlock }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--bg-muted)] p-3">
      <p className="text-sm font-medium">{title}</p>
      <dl className="mt-2">
        <Row label="Orders">{s.orders}</Row>
        <Row label="Completed">{s.completedOrders}</Row>
        <Row label="Net sales">{money(s.netSales)}</Row>
        <Row label="Gross profit">
          <ProfitText value={s.grossProfit} missing={s.ordersMissingCost} />
        </Row>
        <Row label="Avg. order">{money(s.averageOrderValue)}</Row>
      </dl>
    </div>
  )
}

export function ProfileProfitability({
  metrics,
  lifetime,
}: {
  metrics: CustomerMetrics
  lifetime: CustomerMetrics
}) {
  if (!lifetime.profitVisible) {
    return (
      <p className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 text-sm text-[var(--fg-muted)]">
        Profit data is limited to administrators.
      </p>
    )
  }

  const hasPeriod = metrics !== lifetime
  const missing = metrics.sales.grossProfit === null && metrics.sales.ordersMissingCost > 0

  return (
    <div className="min-w-0 space-y-4">
      {missing ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] px-3 py-2 text-sm text-[var(--warning)]">
          No cost price on {metrics.sales.ordersMissingCost} order
          {metrics.sales.ordersMissingCost === 1 ? '' : 's'} — add cost prices to see profit.
        </p>
      ) : null}
      <div className={`grid min-w-0 gap-4 ${hasPeriod ? 'lg:grid-cols-2' : ''}`}>
        <Section title={hasPeriod ? 'Profit · this period' : 'Profit'}>
          <Breakdown s={metrics.sales} shipping={metrics.sales.shippingCollected} />
        </Section>
        {hasPeriod ? (
          <Section title="Profit · all time">
            <Breakdown s={lifetime.sales} shipping={lifetime.sales.shippingCollected} />
          </Section>
        ) : null}
      </div>
      <Section title="Retail vs wholesale">
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <ChannelCard title="Retail" s={metrics.channels.retail} />
          <ChannelCard title="Wholesale" s={metrics.channels.wholesale} />
        </div>
      </Section>
    </div>
  )
}
