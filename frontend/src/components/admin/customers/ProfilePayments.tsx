import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/format'
import type { CustomerMetrics, CustomerProfile } from '@/types'
import { Section, StatCard } from './shared'
import { money } from './utils'

export function ProfilePayments({
  profile,
  metrics,
  lifetime,
  scope,
}: {
  profile: CustomerProfile
  metrics: CustomerMetrics
  lifetime: CustomerMetrics | null
  scope: string
}) {
  const p = metrics.payments
  const life = (v: number) => (lifetime ? `Lifetime: ${money(v)}` : undefined)
  const L = lifetime?.payments

  return (
    <div className="min-w-0 space-y-4">
      <p className="text-xs text-[var(--fg-muted)]">Figures: {scope}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
        <StatCard label="Total paid" value={money(p.totalPaid)} hint={L ? life(L.totalPaid) : undefined} />
        <StatCard label="Deposits received" value={money(p.depositsReceived)} hint={L ? life(L.depositsReceived) : undefined} />
        <StatCard label="Deposits awaiting" value={money(p.depositsAwaiting)} />
        <StatCard label="Due on delivery" value={money(p.dueOnDelivery)} />
        <StatCard label="To collect (open orders)" value={money(p.toCollect)} />
        <StatCard label="Refunds total" value={money(p.refunds)} hint={L ? life(L.refunds) : undefined} />
        <StatCard label="Cash-on-delivery orders" value={p.codOrders} />
        <StatCard
          label="Payment methods"
          value={
            p.methods.length ? (
              <span className="flex flex-wrap gap-1">
                {p.methods.map((m) => (
                  <Badge key={m} variant="muted">
                    {m}
                  </Badge>
                ))}
              </span>
            ) : (
              '—'
            )
          }
        />
      </div>

      <Section title={`Refund history (${profile.refunds.length})`}>
        {profile.refunds.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {profile.refunds.map((r, i) => (
              <li key={`${r.orderId}-${i}`} className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p>
                    <Link to={`/admin/orders/${r.orderId}`} className="font-medium hover:text-[var(--brand-text)]">
                      #{r.orderNumber}
                    </Link>{' '}
                    <span className="text-xs text-[var(--fg-muted)]">{formatDateTime(r.at)}</span>
                  </p>
                  <p className="mt-0.5 break-words text-[var(--fg-muted)]">{r.reason || 'No reason given'}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="font-medium text-[var(--danger)]">−{money(r.amount)}</span>
                  <Badge variant={r.itemsReturned ? 'brand' : 'muted'}>
                    {r.itemsReturned ? 'Items returned' : 'Items not returned'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No refunds.</p>
        )}
      </Section>
    </div>
  )
}
