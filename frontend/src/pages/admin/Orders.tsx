import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { ORDER_STATUSES, orderStatusVariant } from '@/lib/admin'
import { useAdminStats } from '@/hooks/useAdminStats'
import type { OrderStatus, User } from '@/types'
import { cn } from '@/lib/cn'

export function Orders() {
  const stats = useAdminStats()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') || '') as OrderStatus | ''
  const [q, setQ] = useState(params.get('q') || '')
  const page = Number(params.get('page') || 1)

  useEffect(() => {
    setQ(params.get('q') || '')
  }, [params])

  const orders = useQuery({
    queryKey: ['admin-orders', { page, status, q: params.get('q') || '' }],
    queryFn: async () => {
      const res = await adminApi.orders.list({
        page,
        limit: 20,
        status: status || undefined,
        q: params.get('q') || undefined,
      })
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })

  const setFilter = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) next.delete(k)
      else next.set(k, v)
    })
    if (!('page' in patch)) next.set('page', '1')
    setParams(next)
  }

  const items = orders.data?.items ?? []

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader
        title="Orders"
        description="Filter, search, and move COD orders through the pipeline."
      />

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setFilter({ status: undefined })}
          className={cn(
            'h-8 shrink-0 rounded-full border px-2.5 text-xs whitespace-nowrap sm:h-9 sm:px-3 sm:text-sm',
            !status
              ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
              : 'border-[var(--border)]'
          )}
        >
          All ({stats.data?.orderCount ?? '—'})
        </button>
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter({ status: s })}
            className={cn(
              'h-8 shrink-0 rounded-full border px-2.5 text-xs capitalize whitespace-nowrap sm:h-9 sm:px-3 sm:text-sm',
              status === s
                ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                : 'border-[var(--border)]'
            )}
          >
            {s} ({stats.data?.ordersByStatus?.[s] ?? 0})
          </button>
        ))}
      </div>

      <form
        className="w-full max-w-sm"
        onSubmit={(e) => {
          e.preventDefault()
          setFilter({ q: q || undefined })
        }}
      >
        <Input
          placeholder="Search order number"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>

      {orders.isPending && !orders.data ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : orders.isError ? (
        <QueryErrorState onRetry={() => orders.refetch()} />
      ) : (
        <>
          <div className="space-y-2.5 md:hidden">
            {items.map((o) => {
              const user = o.user as User
              return (
                <Link
                  key={o._id}
                  to={`/admin/orders/${o._id}`}
                  className="block min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 transition active:border-[var(--brand)]"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium text-[var(--brand-text)]">
                        #{o.orderNumber}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-[var(--fg)]">
                        {user?.name || '—'}
                      </p>
                      <p className="truncate text-[11px] text-[var(--fg-muted)]">{user?.email}</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(o.pricing.total)}
                    </p>
                  </div>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                    <Badge variant={orderStatusVariant(o.orderStatus)}>
                      {o.orderStatus === 'processing' ? 'confirmed' : o.orderStatus}
                    </Badge>
                    <span className="text-[11px] uppercase text-[var(--fg-muted)]">
                      {o.paymentMethod} · {o.paymentStatus}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-[var(--fg-muted)]">
                    {formatDateTime(o.createdAt)}
                  </p>
                </Link>
              )
            })}
            {!items.length ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
                No orders found.
              </p>
            ) : null}
          </div>

          <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Placed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Pay</th>
                  <th className="px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const user = o.user as User
                  return (
                    <tr key={o._id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/orders/${o._id}`}
                          className="font-medium text-[var(--brand-text)]"
                        >
                          #{o.orderNumber}
                        </Link>
                      </td>
                      <td className="max-w-[12rem] px-4 py-3">
                        <p className="truncate">{user?.name || '—'}</p>
                        <p className="truncate text-xs text-[var(--fg-muted)]">{user?.email}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={orderStatusVariant(o.orderStatus)}>
                          {o.orderStatus === 'processing' ? 'confirmed' : o.orderStatus}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 uppercase text-[var(--fg-muted)]">
                        {o.paymentMethod} · {o.paymentStatus}
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums">
                        {formatCurrency(o.pricing.total)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            pages={orders.data?.meta?.pages || 1}
            onChange={(p) => setFilter({ page: String(p) })}
          />
        </>
      )}
    </div>
  )
}
