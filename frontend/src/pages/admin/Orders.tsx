import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency, formatDateTime } from '@/lib/format'
import {
  GROUP_DOT,
  ORDER_GROUPS,
  ORDER_STATUS_GROUP,
  ORDER_TRANSITIONS,
  attentionReasons,
  formatDeliveryDay,
  orderStatusLabel,
  orderStatusVariant,
  refundState,
  statusesInGroup,
  type OrderStatusGroup,
} from '@/lib/orderStatus'
import { useAdminStats } from '@/hooks/useAdminStats'
import { toast } from '@/store/toastStore'
import type { Order, OrderStatus, User } from '@/types'
import { cn } from '@/lib/cn'
import { OrderThumbs } from '@/components/admin/OrderThumbs'

/** "YYYY-MM-DD" in Morocco time, `offset` days from today. */
function moroccoDay(offset = 0) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date())
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const QUICK_RANGES = [
  { label: 'Today', from: () => moroccoDay(0) },
  { label: '7 days', from: () => moroccoDay(-6) },
  { label: '30 days', from: () => moroccoDay(-29) },
]

/** Statuses that may move to `to` (from the shared transition table). */
const sourcesOf = (to: OrderStatus) =>
  (Object.keys(ORDER_TRANSITIONS) as OrderStatus[]).filter((s) => ORDER_TRANSITIONS[s].includes(to))

/**
 * Bulk status changes, each sent through the normal per-order update (stock, emails, deposit rules).
 * Only moves that need no extra details (a failed delivery needs a reason, a reschedule a date).
 */
const BULK_ACTIONS: { status: OrderStatus; label: string; from: OrderStatus[]; danger?: boolean }[] = [
  { status: 'confirmed', label: 'Confirm', from: sourcesOf('confirmed') },
  { status: 'no_answer', label: 'No answer', from: sourcesOf('no_answer') },
  { status: 'shipped', label: 'Mark shipped', from: sourcesOf('shipped') },
  { status: 'delivered', label: 'Mark delivered', from: sourcesOf('delivered') },
  { status: 'cancelled', label: 'Cancel', from: sourcesOf('cancelled'), danger: true },
]

/** Status badge plus the flags staff need to see in a list. */
function StatusCell({ o }: { o: Order }) {
  const refundBadge = refundState(o) === 'due'
  // The refund badge already says it
  const reasons = attentionReasons(o).filter((r) => !(refundBadge && r === 'Refund due'))
  return (
    <>
      <Badge variant={orderStatusVariant(o.orderStatus)}>{orderStatusLabel(o.orderStatus)}</Badge>
      {o.orderStatus === 'pending' && o.deposit?.status === 'pending' ? <Badge variant="warning">Awaiting deposit</Badge> : null}
      {o.orderStatus === 'rescheduled' && o.rescheduledFor ? (
        <span className="text-[11px] text-[var(--fg-muted)]">→ {formatDeliveryDay(o.rescheduledFor)}</span>
      ) : null}
      {refundBadge ? <Badge variant="danger">Refund pending</Badge> : null}
      {reasons.length ? (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--warning)]"
          title={reasons.join(' · ')}
        >
          <SiteIcon name="alert" size={12} />
          <span className="max-w-[10rem] truncate">{reasons[0]}</span>
        </span>
      ) : null}
    </>
  )
}

const chip = (on: boolean) =>
  cn(
    'h-8 shrink-0 rounded-full border px-2.5 text-xs whitespace-nowrap sm:h-9 sm:px-3 sm:text-sm',
    on ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]' : 'border-[var(--border)]'
  )

function customerName(o: Order) {
  const user = o.user as User | undefined
  return o.shippingAddress?.fullName || user?.name || '—'
}

export function Orders() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const stats = useAdminStats()
  const [params, setParams] = useSearchParams()
  // A status, "group:<group>" or "attention"
  const status = params.get('status') || ''
  const activeGroup: OrderStatusGroup | null = status.startsWith('group:')
    ? (status.slice(6) as OrderStatusGroup)
    : status && status !== 'attention'
      ? (ORDER_STATUS_GROUP[status as OrderStatus] ?? null)
      : null
  const count = (s: OrderStatus) => stats.data?.ordersByStatus?.[s] ?? 0
  const groupCount = (g: OrderStatusGroup) => statusesInGroup(g).reduce((a, s) => a + count(s), 0)
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const [q, setQ] = useState(params.get('q') || '')
  const page = Number(params.get('page') || 1)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState<(typeof BULK_ACTIONS)[number] | null>(null)

  useEffect(() => {
    setQ(params.get('q') || '')
  }, [params])

  const orders = useQuery({
    queryKey: ['admin-orders', { page, status, q: params.get('q') || '', from, to }],
    queryFn: async () => {
      const res = await adminApi.orders.list({
        page,
        limit: 20,
        status: status || undefined,
        q: params.get('q') || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-orders'] })
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
    qc.invalidateQueries({ queryKey: ['admin-inventory'] })
  }

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.orders.remove(id),
    onSuccess: () => {
      refresh()
      toast.success('Order deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const items = orders.data?.items ?? []
  const selectedOrders = items.filter((o) => selected.has(o._id))

  // One request per order, in turn; failures are listed and stay selected
  const runBulk = useMutation({
    mutationFn: async (action: (typeof BULK_ACTIONS)[number]) => {
      const targets = selectedOrders.filter((o) => action.from.includes(o.orderStatus))
      const failed: { order: Order; error: string }[] = []
      let done = 0
      for (const o of targets) {
        try {
          await adminApi.orders.updateStatus(o._id, { orderStatus: action.status })
          done += 1
        } catch (e) {
          failed.push({ order: o, error: getErrorMessage(e) })
        }
      }
      return { done, failed, skipped: selectedOrders.length - targets.length }
    },
    onSuccess: ({ done, failed, skipped }, action) => {
      refresh()
      setBulk(null)
      setSelected(new Set(failed.map((f) => f.order._id)))
      const parts = [`${done} order${done === 1 ? '' : 's'} → ${orderStatusLabel(action.status).toLowerCase()}`]
      if (skipped) parts.push(`${skipped} skipped (status not eligible)`)
      if (failed.length) {
        parts.push(`${failed.length} failed: ${failed.map((f) => `#${f.order.orderNumber} (${f.error})`).join('; ')}`)
        toast.error(parts.join(' · '))
      } else {
        toast.success(parts.join(' · '))
      }
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const setFilter = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => {
      if (!v) next.delete(k)
      else next.set(k, v)
    })
    if (!('page' in patch)) next.set('page', '1')
    setParams(next)
    setSelected(new Set())
  }

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const allOnPage = items.length > 0 && items.every((o) => selected.has(o._id))
  const toggleAll = () => setSelected(allOnPage ? new Set() : new Set(items.map((o) => o._id)))

  const eligible = (a: (typeof BULK_ACTIONS)[number]) => selectedOrders.filter((o) => a.from.includes(o.orderStatus)).length
  const printSlips = (ids: string[]) => navigate(`/admin-print/slips?ids=${ids.join(',')}`)
  const hasDates = Boolean(from || to)

  return (
    <div className={cn('min-w-0 space-y-4 sm:space-y-6', selected.size > 0 && 'pb-20')}>
      <AdminHeader title="Orders" description="Filter by status or date, select orders to update or print in bulk." />

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={() => setFilter({ status: undefined })} className={chip(!status)}>
          All ({stats.data?.orderCount ?? '—'})
        </button>
        <button type="button" onClick={() => setFilter({ status: 'attention' })} className={cn(chip(status === 'attention'), 'inline-flex items-center gap-1.5')}>
          <SiteIcon name="alert" size={13} className="text-[var(--warning)]" />
          Needs attention ({stats.data?.attentionOrders ?? 0})
        </button>
        {ORDER_GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setFilter({ status: `group:${g.id}` })}
            className={cn(chip(activeGroup === g.id), 'inline-flex items-center gap-1.5')}
          >
            <span className={cn('h-2 w-2 rounded-full', GROUP_DOT[g.id])} />
            {g.label} ({groupCount(g.id)})
          </button>
        ))}
      </div>
      {activeGroup && statusesInGroup(activeGroup).length > 1 ? (
        <div className="-mt-2 flex flex-wrap gap-1.5 sm:-mt-3">
          {statusesInGroup(activeGroup).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setFilter({ status: status === s ? `group:${activeGroup}` : s })}
              className={cn(chip(status === s), 'h-7 text-xs sm:h-7 sm:text-xs')}
            >
              {orderStatusLabel(s)} ({count(s)})
            </button>
          ))}
        </div>
      ) : null}

      {/* Search + dates */}
      <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-end">
        <form
          className="min-w-0 flex-1 lg:max-w-sm"
          onSubmit={(e) => {
            e.preventDefault()
            setFilter({ q: q.trim() || undefined })
          }}
        >
          <Input
            type="search"
            aria-label="Search orders"
            placeholder="Order number, customer name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <div className="flex min-w-0 flex-wrap items-end gap-2">
          <label className="flex min-w-[8.5rem] flex-1 flex-col gap-1 text-xs text-[var(--fg-muted)] sm:flex-none">
            From
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => setFilter({ from: e.target.value || undefined })}
              className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--fg)]"
            />
          </label>
          <label className="flex min-w-[8.5rem] flex-1 flex-col gap-1 text-xs text-[var(--fg-muted)] sm:flex-none">
            To
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => setFilter({ to: e.target.value || undefined })}
              className="h-10 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--fg)]"
            />
          </label>
          <div className="flex w-full gap-1.5 sm:w-auto">
            {QUICK_RANGES.map((r) => {
              const f = r.from()
              const on = from === f && (!to || to === moroccoDay(0))
              return (
                <button key={r.label} type="button" className={chip(on)} onClick={() => setFilter({ from: f, to: undefined })}>
                  {r.label}
                </button>
              )
            })}
            {hasDates ? (
              <button type="button" className={chip(false)} onClick={() => setFilter({ from: undefined, to: undefined })} aria-label="Clear dates">
                <SiteIcon name="close" size={12} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {orders.isPending && !orders.data ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : orders.isError ? (
        <QueryErrorState onRetry={() => orders.refetch()} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-xs text-[var(--fg-muted)]">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={allOnPage} onChange={toggleAll} disabled={!items.length} />
              Select all on this page
            </label>
            <span>
              {orders.data?.meta?.total ?? items.length} order{(orders.data?.meta?.total ?? items.length) === 1 ? '' : 's'}
            </span>
          </div>

          {/* Phones */}
          <div className="space-y-2 md:hidden">
            {items.map((o) => (
              <div
                key={o._id}
                className={cn(
                  'flex min-w-0 gap-2.5 overflow-hidden rounded-xl border bg-[var(--bg-elevated)] p-3',
                  selected.has(o._id) ? 'border-[var(--brand)]' : 'border-[var(--border)]'
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
                  checked={selected.has(o._id)}
                  onChange={() => toggle(o._id)}
                  aria-label={`Select order ${o.orderNumber}`}
                />
                <Link to={`/admin/orders/${o._id}`} className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--brand-text)]">#{o.orderNumber}</p>
                      <p className="truncate text-xs">
                        {customerName(o)}
                        {o.shippingAddress?.city ? <span className="text-[var(--fg-muted)]"> · {o.shippingAddress.city}</span> : null}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(o.pricing.total)}</p>
                  </div>
                  {o.items?.length ? (
                    <div className="mt-1.5">
                      <OrderThumbs items={o.items} size="sm" max={4} />
                    </div>
                  ) : null}
                  <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                    <StatusCell o={o} />
                    <span className="text-[11px] text-[var(--fg-muted)]">{formatDateTime(o.createdAt)}</span>
                  </div>
                </Link>
              </div>
            ))}
            {!items.length ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
                No orders found.
              </p>
            ) : null}
          </div>

          {/* Desktop */}
          <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={allOnPage} onChange={toggleAll} aria-label="Select all on this page" disabled={!items.length} />
                  </th>
                  <th className="px-3 py-3">Order</th>
                  <th className="px-3 py-3">Products</th>
                  <th className="px-3 py-3">Customer</th>
                  <th className="px-3 py-3">Placed</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Total</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((o) => (
                  <tr key={o._id} className={cn('border-t border-[var(--border)]', selected.has(o._id) && 'bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]')}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--brand)]"
                        checked={selected.has(o._id)}
                        onChange={() => toggle(o._id)}
                        aria-label={`Select order ${o.orderNumber}`}
                      />
                    </td>
                    <td className="px-3 py-3">
                      <Link to={`/admin/orders/${o._id}`} className="font-medium text-[var(--brand-text)]">
                        #{o.orderNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {o.items?.length ? <OrderThumbs items={o.items} /> : null}
                    </td>
                    <td className="max-w-[14rem] px-3 py-3">
                      <p className="truncate">{customerName(o)}</p>
                      <p className="truncate text-xs text-[var(--fg-muted)]">
                        {o.shippingAddress?.phone}
                        {o.shippingAddress?.city ? ` · ${o.shippingAddress.city}` : ''}
                      </p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">{formatDateTime(o.createdAt)}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusCell o={o} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium tabular-nums">{formatCurrency(o.pricing.total)}</td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" aria-label="Print delivery slip" title="Print delivery slip" onClick={() => printSlips([o._id])}>
                          <SiteIcon name="package" size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Delete order" onClick={() => setDeleteId(o._id)}>
                          <SiteIcon name="trash" size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">
                      No orders found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={orders.data?.meta?.pages || 1} onChange={(p) => setFilter({ page: String(p) })} />
        </>
      )}

      {/* Bulk bar */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-lg backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <button type="button" className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <div className="ms-auto flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => printSlips([...selected])}>
                <SiteIcon name="package" size={14} /> Print slips
              </Button>
              {BULK_ACTIONS.map((a) => (
                <Button
                  key={a.status}
                  size="sm"
                  variant={a.danger ? 'ghost' : 'outline'}
                  className={a.danger ? 'text-[var(--danger)]' : undefined}
                  disabled={!eligible(a) || runBulk.isPending}
                  title={eligible(a) ? undefined : `None of the selected orders can be set to ${orderStatusLabel(a.status).toLowerCase()}`}
                  onClick={() => setBulk(a)}
                >
                  {a.label}
                  {eligible(a) && eligible(a) !== selected.size ? ` (${eligible(a)})` : ''}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(bulk)}
        title={bulk ? `${bulk.label} ${eligible(bulk)} order${eligible(bulk) === 1 ? '' : 's'}?` : ''}
        description={
          bulk
            ? `Each order is updated like on its own page (stock, customer email, deposit checks). ${
                selected.size - eligible(bulk) ? `${selected.size - eligible(bulk)} selected order(s) are skipped because their status doesn't allow it. ` : ''
              }Orders that fail stay selected.`
            : ''
        }
        confirmLabel={bulk?.label ?? 'Confirm'}
        loading={runBulk.isPending}
        onClose={() => setBulk(null)}
        onConfirm={() => bulk && runBulk.mutate(bulk)}
      />

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete order?"
        description="This permanently removes the order. Reserved stock is restored when needed."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
        }}
      />
    </div>
  )
}
