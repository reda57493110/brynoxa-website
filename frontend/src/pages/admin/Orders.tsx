import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
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

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Orders"
        description="Filter, search, and move COD orders through the pipeline."
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter({ status: undefined })}
          className={cn(
            'h-9 rounded-full border px-3 text-sm',
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
              'h-9 rounded-full border px-3 text-sm capitalize',
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
        className="max-w-sm"
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

      {orders.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
            <table className="w-full min-w-[760px] text-left text-sm">
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
                {orders.data?.items.map((o) => {
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
                      <td className="px-4 py-3">
                        <p>{user?.name || '—'}</p>
                        <p className="text-xs text-[var(--fg-muted)]">{user?.email}</p>
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
                      <td className="px-4 py-3 font-medium">{formatCurrency(o.pricing.total)}</td>
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
