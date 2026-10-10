import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { RETURN_OUTCOME_LABELS, invCard, returnCustomerName } from '@/components/admin/inventory/MovementLabels'
import { ReturnAssessForm } from '@/components/admin/inventory/ReturnAssessForm'
import { ReturnStatusBadge } from '@/components/admin/inventory/ReturnBits'
import { Badge } from '@/components/ui/Badge'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { formatDate, formatDateTime } from '@/lib/format'

export function InventoryReturn() {
  const { id = '' } = useParams()
  const ret = useQuery({
    queryKey: ['admin-inventory', 'return', id],
    queryFn: async () => (await inventoryApi.returnDetail(id)).data.data,
    enabled: Boolean(id),
  })

  if (ret.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="lg" />
      </div>
    )
  }
  if (ret.isError) return <QueryErrorState title="Could not load this return" onRetry={() => ret.refetch()} />
  const r = ret.data
  const customer = typeof r.customer === 'string' ? null : r.customer

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <Link to="/admin/inventory/returns" className="inline-flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <SiteIcon name="arrow-left" size={14} /> Returns
      </Link>
      <AdminHeader title={`Return · #${r.orderNumber}`} actions={<ReturnStatusBadge status={r.status} />} />

      <section className={`${invCard} p-3 sm:p-5`}>
        <dl className="grid min-w-0 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <div className="min-w-0">
            <dt className="text-xs text-[var(--fg-muted)]">Order</dt>
            <dd>
              <Link to={`/admin/orders/${r.order}`} className="text-[var(--brand-text)] hover:underline">
                #{r.orderNumber}
              </Link>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-[var(--fg-muted)]">Customer</dt>
            <dd className="break-words">
              {customer?._id ? (
                <Link to={`/admin/customers/${customer._id}`} className="hover:text-[var(--brand-text)]">
                  {returnCustomerName(r.customer)}
                </Link>
              ) : (
                returnCustomerName(r.customer)
              )}
              {customer?.phone ? <span className="block text-xs text-[var(--fg-muted)]">{customer.phone}</span> : null}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-[var(--fg-muted)]">Returned</dt>
            <dd>{formatDate(r.returnedAt)}</dd>
          </div>
        </dl>
        <p className="mt-3 rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-xs text-[var(--fg-muted)]">
          Returned units are not sellable until assessed. Refunds are recorded on the order and don't change stock.
        </p>
      </section>

      {r.lines.map((line) => {
        const done = line.assessed.reduce((s, a) => s + a.qty, 0)
        const remaining = line.qty - done
        return (
          <section key={line._id} className={`${invCard} p-3 sm:p-5`}>
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/admin/inventory/products/${line.product}`} className="break-words font-semibold hover:text-[var(--brand-text)]">
                  {line.name}
                </Link>
                <p className="text-xs text-[var(--fg-muted)]">
                  {line.sku} · {line.qty} returned
                </p>
              </div>
              <Badge variant={remaining > 0 ? 'warning' : 'success'}>{remaining > 0 ? `${remaining} to assess` : 'Done'}</Badge>
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="shrink-0 text-[var(--fg-muted)]">Reason:</dt>
                <dd className="min-w-0 break-words">{line.reason}</dd>
              </div>
              {line.conditionNote ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-[var(--fg-muted)]">Condition:</dt>
                  <dd className="min-w-0 break-words">{line.conditionNote}</dd>
                </div>
              ) : null}
              {line.serials.length ? (
                <div className="flex gap-2">
                  <dt className="shrink-0 text-[var(--fg-muted)]">Serials:</dt>
                  <dd className="min-w-0 break-all font-mono text-xs leading-5">{line.serials.join(', ')}</dd>
                </div>
              ) : null}
            </dl>

            {line.assessed.length ? (
              <ul className="mt-3 space-y-1.5">
                {line.assessed.map((a, i) => {
                  const t = a.targetProduct
                  return (
                    <li key={`${a.at}-${i}`} className="min-w-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>{a.qty}</strong> × {RETURN_OUTCOME_LABELS[a.outcome] ?? a.outcome}
                        </span>
                        <span className="text-xs text-[var(--fg-muted)]">{formatDateTime(a.at)}</span>
                      </div>
                      {t ? (
                        <p className="text-xs text-[var(--fg-muted)]">
                          To{' '}
                          <Link to={`/admin/inventory/products/${typeof t === 'string' ? t : t._id}`} className="text-[var(--brand-text)] hover:underline">
                            {typeof t === 'string' ? 'listing' : `${t.name} (${t.sku})`}
                          </Link>
                        </p>
                      ) : null}
                      {a.note ? <p className="break-words text-xs text-[var(--fg-muted)]">{a.note}</p> : null}
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {remaining > 0 ? <ReturnAssessForm key={`${line._id}-${remaining}`} returnId={r._id} line={line} remaining={remaining} /> : null}
          </section>
        )
      })}
    </div>
  )
}
