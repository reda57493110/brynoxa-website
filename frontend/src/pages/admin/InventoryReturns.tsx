import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { InventoryNav } from '@/components/admin/inventory/InventoryNav'
import { invCard, returnCustomerName } from '@/components/admin/inventory/MovementLabels'
import { ReturnStatusBadge } from '@/components/admin/inventory/ReturnBits'
import { Pagination } from '@/components/ui/Pagination'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import type { CustomerReturn } from '@/types'

const FILTERS: { value: CustomerReturn['status'] | ''; label: string }[] = [
  { value: 'awaiting-assessment', label: 'Awaiting assessment' },
  { value: 'assessed', label: 'Assessed' },
  { value: '', label: 'All' },
]

const chip = (active: boolean) =>
  cn(
    'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition',
    active ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-text)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
  )

export function InventoryReturns() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(Number(params.get('page') || 1), 1)
  const status = (params.has('status') ? params.get('status') || '' : 'awaiting-assessment') as CustomerReturn['status'] | ''

  const set = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(patch).forEach(([k, v]) => (v === undefined ? next.delete(k) : next.set(k, v)))
        return next
      },
      { replace: true }
    )

  const returns = useQuery({
    queryKey: ['admin-inventory', 'returns', { page, status }],
    queryFn: async () => {
      const res = await inventoryApi.returns({ page, limit: 20, status })
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })
  const items = returns.data?.items ?? []

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InventoryNav />
      <AdminHeader
        title="Returns"
        description="Returned units are never sellable until assessed. Refunds (money) are separate and don't change stock."
      />

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Return status">
        {FILTERS.map((f) => (
          <button
            key={f.value || 'all'}
            type="button"
            aria-pressed={status === f.value}
            className={chip(status === f.value)}
            onClick={() => set({ status: f.value === 'awaiting-assessment' ? undefined : f.value, page: undefined })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {returns.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : returns.isError ? (
        <QueryErrorState onRetry={() => returns.refetch()} />
      ) : !items.length ? (
        <p className={`${invCard} px-4 py-10 text-center text-sm text-[var(--fg-muted)]`}>
          No returns here. Register returns from the order page.
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <ul className="space-y-2.5 md:hidden">
            {items.map((r) => (
              <li key={r._id}>
                <Link to={`/admin/inventory/returns/${r._id}`} className={`${invCard} block p-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">#{r.orderNumber}</p>
                      <p className="truncate text-xs text-[var(--fg-muted)]">
                        {returnCustomerName(r.customer)} · {formatDate(r.returnedAt)}
                      </p>
                    </div>
                    <ReturnStatusBadge status={r.status} />
                  </div>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    {r.lines.map((l) => (
                      <li key={l._id} className="break-words">
                        {l.qty} × {l.name} <span className="text-[var(--fg-muted)]">— {l.reason}</span>
                      </li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className={`${invCard} hidden overflow-x-auto md:block`}>
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs text-[var(--fg-muted)]">
                <tr>
                  <th className="px-3 py-3 font-medium">Returned</th>
                  <th className="px-3 py-3 font-medium">Order</th>
                  <th className="px-3 py-3 font-medium">Customer</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                  <th className="px-3 py-3 font-medium">Reasons</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r._id}
                    className="cursor-pointer border-t border-[var(--border)] align-top hover:bg-[var(--bg-muted)]/50"
                    onClick={() => navigate(`/admin/inventory/returns/${r._id}`)}
                  >
                    <td className="whitespace-nowrap px-3 py-3">
                      <Link to={`/admin/inventory/returns/${r._id}`} className="hover:text-[var(--brand-text)]" onClick={(e) => e.stopPropagation()}>
                        {formatDate(r.returnedAt)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <Link to={`/admin/orders/${r.order}`} className="text-[var(--brand-text)] hover:underline" onClick={(e) => e.stopPropagation()}>
                        #{r.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{returnCustomerName(r.customer)}</td>
                    <td className="px-3 py-3">
                      {r.lines.map((l) => (
                        <p key={l._id} className="max-w-[16rem] truncate">
                          {l.qty} × {l.name}
                        </p>
                      ))}
                    </td>
                    <td className="px-3 py-3 text-[var(--fg-muted)]">
                      {r.lines.map((l) => (
                        <p key={l._id} className="max-w-[16rem] truncate">
                          {l.reason}
                        </p>
                      ))}
                    </td>
                    <td className="px-3 py-3">
                      <ReturnStatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Pagination page={page} pages={returns.data?.meta?.pages || 1} onChange={(p) => set({ page: p > 1 ? String(p) : undefined })} />
    </div>
  )
}
