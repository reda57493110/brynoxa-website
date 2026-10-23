import { Link } from 'react-router-dom'
import { shownEmail } from '@/lib/orderOrigin'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'
import type { CustomerRow } from '@/types'
import { ProfitText, StatusBadge, TypeBadge, cardClass } from './shared'
import { money } from './utils'

function dateOr(v: string | null | undefined) {
  return v ? formatDate(v) : '—'
}

export function CustomerTable({
  rows,
  profitVisible,
  onToggle,
  togglingId,
}: {
  rows: CustomerRow[]
  profitVisible: boolean
  onToggle: (row: CustomerRow) => void
  togglingId: string | null
}) {
  if (!rows.length) {
    return (
      <p className={`${cardClass} px-4 py-10 text-center text-sm text-[var(--fg-muted)]`}>
        No customers match these filters.
      </p>
    )
  }

  const isDisabled = (r: CustomerRow) => r.status === 'disabled'

  return (
    <>
      {/* Phones: compact cards — tap to open the customer */}
      <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] md:hidden">
        {rows.map((c) => {
          const m = c.metrics
          return (
            <li key={c._id} className="min-w-0">
              <Link to={`/admin/customers/${c._id}`} className="block min-w-0 px-3 py-2.5 active:bg-[var(--bg-muted)]">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {c.name}
                      {c.companyName ? <span className="font-normal text-[var(--fg-muted)]"> · {c.companyName}</span> : null}
                    </p>
                    <p className="truncate text-[11px] text-[var(--fg-muted)]">{shownEmail(c.email)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <StatusBadge status={c.status} />
                    {c.customerType && c.customerType !== 'retail' ? <TypeBadge type={c.customerType} tierName={c.tierName} /> : null}
                  </div>
                </div>
                <dl className="mt-1.5 grid grid-cols-3 gap-2 text-[11px]">
                  <div className="min-w-0">
                    <dt className="text-[var(--fg-muted)]">Orders</dt>
                    <dd className="font-medium tabular-nums">
                      {m.orders.completed}/{m.orders.total}
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[var(--fg-muted)]">Paid</dt>
                    <dd className="truncate font-medium tabular-nums">{money(m.payments.totalPaid)}</dd>
                  </div>
                  <div className="min-w-0 text-end">
                    <dt className="text-[var(--fg-muted)]">Last order</dt>
                    <dd className="truncate font-medium">{dateOr(m.dates.lastOrder)}</dd>
                  </div>
                </dl>
                {profitVisible && m.sales.completedOrders ? (
                  <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                    Net {money(m.sales.netSales)} · profit{' '}
                    <ProfitText value={m.sales.grossProfit} missing={m.sales.ordersMissingCost} className="text-[11px]" />
                  </p>
                ) : null}
              </Link>
              <div className="flex justify-end px-3 pb-2">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" loading={togglingId === c._id} onClick={() => onToggle(c)}>
                  {isDisabled(c) ? 'Enable account' : 'Disable account'}
                </Button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Desktop: table scrolls inside its card */}
      <div className={`${cardClass} hidden min-w-0 overflow-x-auto md:block`}>
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="bg-[var(--bg-muted)] text-xs text-[var(--fg-muted)]">
            <tr>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Contact</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 text-right font-medium">Orders</th>
              <th className="px-3 py-3 text-right font-medium">Amount paid</th>
              <th className="px-3 py-3 text-right font-medium">Net sales</th>
              {profitVisible ? <th className="px-3 py-3 text-right font-medium">Gross profit</th> : null}
              <th className="px-3 py-3 text-right font-medium">Avg order</th>
              <th className="px-3 py-3 font-medium">First order</th>
              <th className="px-3 py-3 font-medium">Last order</th>
              <th className="px-3 py-3 font-medium">Registered</th>
              <th className="px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const m = c.metrics
              return (
                <tr key={c._id} className="border-t border-[var(--border)] align-top">
                  <td className="max-w-[12rem] px-3 py-3">
                    <Link to={`/admin/customers/${c._id}`} className="block truncate font-medium hover:text-[var(--brand-text)]">
                      {c.name}
                    </Link>
                    <p className="truncate text-xs text-[var(--fg-muted)]">{c.customerId}</p>
                    {c.companyName ? <p className="truncate text-xs text-[var(--fg-muted)]">{c.companyName}</p> : null}
                  </td>
                  <td className="max-w-[14rem] px-3 py-3">
                    <p className="truncate">{shownEmail(c.email)}</p>
                    <p className="truncate text-xs text-[var(--fg-muted)]">{c.phone || '—'}</p>
                  </td>
                  <td className="px-3 py-3">
                    <TypeBadge type={c.customerType} tierName={c.tierName} />
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {m.orders.completed}/{m.orders.total}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{money(m.payments.totalPaid)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{money(m.sales.netSales)}</td>
                  {profitVisible ? (
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <ProfitText value={m.sales.grossProfit} missing={m.sales.ordersMissingCost} />
                    </td>
                  ) : null}
                  <td className="px-3 py-3 text-right whitespace-nowrap">{money(m.sales.averageOrderValue)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{dateOr(m.dates.firstOrder)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{dateOr(m.dates.lastOrder)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{dateOr(c.registeredAt)}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/admin/customers/${c._id}`}
                        className="inline-flex h-9 items-center rounded-full border border-[var(--border)] px-3 text-sm hover:border-[var(--brand)]"
                        aria-label={`View ${c.name}`}
                      >
                        View
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        loading={togglingId === c._id}
                        onClick={() => onToggle(c)}
                        aria-label={`${isDisabled(c) ? 'Enable' : 'Disable'} ${c.name}`}
                      >
                        {isDisabled(c) ? 'Enable' : 'Disable'}
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
