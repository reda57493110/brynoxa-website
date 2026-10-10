import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/format'
import { orderStatusVariant } from '@/lib/admin'
import type { CustomerMetrics, CustomerProfile } from '@/types'
import { Section, StatCard } from './shared'
import { money } from './utils'

const th = 'px-3 py-2.5 font-medium'
const td = 'px-3 py-2.5'

function dateOr(v: string | null) {
  return v ? formatDate(v) : '—'
}

export function ProfileOrders({
  profile,
  metrics,
  lifetime,
}: {
  profile: CustomerProfile
  metrics: CustomerMetrics
  lifetime: CustomerMetrics | null
}) {
  const o = metrics.orders
  const s = metrics.sales
  const life = (fn: (m: CustomerMetrics) => string) => (lifetime ? `All time: ${fn(lifetime)}` : undefined)

  return (
    <div className="min-w-0 space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        <StatCard label="Orders" value={o.total} hint={life((m) => String(m.orders.total))} />
        <StatCard label="Completed" value={o.completed} hint={life((m) => String(m.orders.completed))} />
        <StatCard label="Open" value={o.open} />
        <StatCard label="Cancelled" value={o.cancelled} />
        <StatCard
          label="Refunded"
          value={o.refunded}
          hint={o.partiallyRefunded ? `+${o.partiallyRefunded} partial` : undefined}
        />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <StatCard label="Order value" value={money(s.totalOrderValue)} hint={life((m) => money(m.sales.totalOrderValue))} />
        <StatCard
          label="Sales"
          value={money(s.completedOrderValue)}
          hint={life((m) => money(m.sales.completedOrderValue))}
        />
        <StatCard label="Avg. order" value={money(s.averageOrderValue)} hint={life((m) => money(m.sales.averageOrderValue))} />
        <StatCard label="First order" value={dateOr(metrics.dates.firstOrder)} />
        <StatCard label="Last order" value={dateOr(metrics.dates.lastOrder)} />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <Section title="Top products">
          {profile.topProducts.length ? (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="text-xs text-[var(--fg-muted)]">
                  <tr>
                    <th className={th}>Product</th>
                    <th className={`${th} text-right`}>Qty</th>
                    <th className={`${th} text-right`}>Orders</th>
                    <th className={`${th} text-right`}>Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.topProducts.map((p) => (
                    <tr key={p.productId} className="border-t border-[var(--border)]">
                      <td className={`${td} max-w-[14rem]`}>
                        {p.slug ? (
                          <Link to={`/product/${p.slug}`} className="block truncate hover:text-[var(--brand-text)]">
                            {p.name}
                          </Link>
                        ) : (
                          <span className="block truncate">{p.name}</span>
                        )}
                      </td>
                      <td className={`${td} text-right`}>{p.qty}</td>
                      <td className={`${td} text-right`}>{p.orders}</td>
                      <td className={`${td} text-right whitespace-nowrap`}>{money(p.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">No purchases yet.</p>
          )}
        </Section>
        <Section title="Categories">
          {profile.categories.length ? (
            <div className="-mx-4 overflow-x-auto sm:-mx-5">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead className="text-xs text-[var(--fg-muted)]">
                  <tr>
                    <th className={th}>Category</th>
                    <th className={`${th} text-right`}>Qty</th>
                    <th className={`${th} text-right`}>Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.categories.map((c) => (
                    <tr key={c.name} className="border-t border-[var(--border)]">
                      <td className={td}>{c.name}</td>
                      <td className={`${td} text-right`}>{c.qty}</td>
                      <td className={`${td} text-right whitespace-nowrap`}>{money(c.spent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">No purchases yet.</p>
          )}
        </Section>
      </div>

      <Section title={`Orders (${profile.orders.length})`}>
        {profile.orders.length ? (
          <div className="-mx-4 overflow-x-auto sm:-mx-5">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-xs text-[var(--fg-muted)]">
                <tr>
                  <th className={th}>Order</th>
                  <th className={th}>Date</th>
                  <th className={th}>Status</th>
                  <th className={th}>Channel</th>
                  <th className={`${th} text-right`}>Items</th>
                  <th className={`${th} text-right`}>Total</th>
                  <th className={`${th} text-right`}>Discount</th>
                  <th className={th}>Deposit</th>
                  <th className={`${th} text-right`}>Refunded</th>
                  <th className={th}>Completed</th>
                </tr>
              </thead>
              <tbody>
                {profile.orders.map((ord) => (
                  <tr key={ord._id} className="border-t border-[var(--border)]">
                    <td className={td}>
                      <Link to={`/admin/orders/${ord._id}`} className="font-medium hover:text-[var(--brand-text)]">
                        #{ord.orderNumber}
                      </Link>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDate(ord.createdAt)}</td>
                    <td className={td}>
                      <Badge variant={orderStatusVariant(ord.orderStatus)}>{ord.orderStatus}</Badge>
                    </td>
                    <td className={`${td} capitalize`}>
                      {ord.channel}
                      {ord.tierName ? <span className="block text-xs text-[var(--fg-muted)]">{ord.tierName}</span> : null}
                    </td>
                    <td className={`${td} text-right`}>{ord.items}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>{money(ord.total)}</td>
                    <td className={`${td} text-right whitespace-nowrap`}>{ord.discount ? money(ord.discount) : '—'}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      {ord.deposit ? (
                        <>
                          {money(ord.deposit.amount)}{' '}
                          <Badge variant={ord.deposit.status === 'received' ? 'success' : 'warning'}>
                            {ord.deposit.status}
                          </Badge>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${td} text-right whitespace-nowrap`}>
                      {ord.refunded ? (
                        <span className="text-[var(--danger)]">
                          {money(ord.refunded)}
                          {ord.fullyRefunded ? ' (full)' : ''}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={td}>
                      <Badge variant={ord.completed ? 'success' : 'muted'}>{ord.completed ? 'Yes' : 'No'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--fg-muted)]">No orders yet.</p>
        )}
      </Section>
    </div>
  )
}
