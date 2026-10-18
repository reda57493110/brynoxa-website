import { useEffect, useState } from 'react'
import { RecordDepositDialog } from '@/components/admin/RecordDepositDialog'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { OrderItemThumb } from '@/components/admin/OrderThumbs'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/format'
import {
  ORDER_GROUPS,
  ORDER_TRANSITIONS,
  attentionReasons,
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

/** "YYYY-MM-DD" in Morocco time, `offset` days from today. */
function moroccoDay(offset = 0) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date())
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const RANGES = [
  { id: 'today', label: 'Today', from: () => moroccoDay(0) },
  { id: '7d', label: 'Last 7 days', from: () => moroccoDay(-6) },
  { id: '30d', label: 'Last 30 days', from: () => moroccoDay(-29) },
]

const SORTS = [
  { id: '', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'total_desc', label: 'Highest total' },
  { id: 'total_asc', label: 'Lowest total' },
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
  { status: 'shipped', label: 'Shipped', from: sourcesOf('shipped') },
  { status: 'delivered', label: 'Delivered', from: sourcesOf('delivered') },
  { status: 'cancelled', label: 'Cancel', from: sourcesOf('cancelled'), danger: true },
]

const control =
  'h-9 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm text-[var(--fg)] outline-none ring-brand'

function customerName(o: Order) {
  const user = o.user as User | undefined
  return o.shippingAddress?.fullName || user?.name || '—'
}

/** One short payment label from the money records (separate from the order status). */
function paymentBadge(o: Order): { label: string; variant: BadgeVariant } {
  const refund = refundState(o)
  if (refund === 'due') return { label: 'Refund due', variant: 'danger' }
  if (refund === 'refunded') return { label: 'Refunded', variant: 'muted' }
  if (refund === 'partial') return { label: 'Part refunded', variant: 'warning' }
  if (o.paymentStatus === 'paid') return { label: 'Paid', variant: 'success' }
  if (o.paymentStatus === 'failed') return { label: 'Not collected', variant: 'muted' }
  if (o.deposit?.status === 'received') return { label: 'Deposit paid', variant: 'brand' }
  if (o.deposit?.status === 'pending' && o.deposit.amount > 0 && o.deposit.payment) return { label: 'Deposit sent · check', variant: 'brand' }
  if (o.deposit?.status === 'pending' && o.deposit.amount > 0) return { label: 'Deposit due', variant: 'warning' }
  return { label: 'COD', variant: 'default' }
}

/** Status badge; a small warning icon (reasons on hover) when the order needs action. */
function StatusBadge({ o }: { o: Order }) {
  const reasons = attentionReasons(o).filter((r) => r !== 'Refund due')
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={orderStatusVariant(o.orderStatus)}>{orderStatusLabel(o.orderStatus)}</Badge>
      {reasons.length ? (
        <span title={reasons.join(' · ')} aria-label={reasons.join(' · ')} className="text-[var(--warning)]">
          <SiteIcon name="alert" size={13} />
        </span>
      ) : null}
    </span>
  )
}

function PaymentBadge({ o }: { o: Order }) {
  const p = paymentBadge(o)
  return (
    <Badge variant={p.variant} className="normal-case">
      {p.label}
    </Badge>
  )
}

export function Orders() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const stats = useAdminStats()
  const [recording, setRecording] = useState(false)
  const [params, setParams] = useSearchParams()
  // A status, "group:<group>" or "attention"
  const status = params.get('status') || ''
  const from = params.get('from') || ''
  const to = params.get('to') || ''
  const sort = params.get('sort') || ''
  const [q, setQ] = useState(params.get('q') || '')
  const page = Number(params.get('page') || 1)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulk, setBulk] = useState<(typeof BULK_ACTIONS)[number] | null>(null)

  const quickRange = !to ? RANGES.find((r) => r.from() === from)?.id : undefined
  const [customDates, setCustomDates] = useState(Boolean((from || to) && !quickRange))

  useEffect(() => {
    setQ(params.get('q') || '')
  }, [params])

  const orders = useQuery({
    queryKey: ['admin-orders', { page, status, q: params.get('q') || '', from, to, sort }],
    queryFn: async () => {
      const res = await adminApi.orders.list({
        page,
        limit: 20,
        status: status || undefined,
        q: params.get('q') || undefined,
        from: from || undefined,
        to: to || undefined,
        sort: sort || undefined,
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
  const total = orders.data?.meta?.total ?? items.length
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

  const onRange = (value: string) => {
    if (value === 'custom') {
      setCustomDates(true)
      return
    }
    setCustomDates(false)
    const r = RANGES.find((x) => x.id === value)
    setFilter({ from: r?.from(), to: undefined })
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

  const count = (s: OrderStatus) => stats.data?.ordersByStatus?.[s] ?? 0
  const groupCount = (g: OrderStatusGroup) => statusesInGroup(g).reduce((a, s) => a + count(s), 0)
  const attention = stats.data?.attentionOrders ?? 0
  const filtered = Boolean(status || params.get('q') || from || to)

  return (
    <div className={cn('min-w-0 space-y-3', selected.size > 0 && 'pb-20')}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">Orders</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setRecording(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-xs font-medium text-[var(--brand-text)] hover:border-[var(--brand)]"
        >
          <SiteIcon name="banknote" size={13} /> Record deposit
        </button>
        {attention ? (
          <button
            type="button"
            onClick={() => setFilter({ status: status === 'attention' ? undefined : 'attention' })}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium',
              status === 'attention'
                ? 'border-[var(--warning)] text-[var(--warning)]'
                : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
            )}
          >
            <SiteIcon name="alert" size={13} className="text-[var(--warning)]" />
            {attention} need{attention === 1 ? 's' : ''} attention
          </button>
        ) : null}
        </div>
      </div>
      <RecordDepositDialog open={recording} onClose={() => setRecording(false)} />

      {/* Toolbar */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <form
          className="relative min-w-0 basis-full sm:flex-[1_1_14rem] sm:basis-auto"
          onSubmit={(e) => {
            e.preventDefault()
            setFilter({ q: q.trim() || undefined })
          }}
        >
          <SiteIcon name="search" size={15} className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
          <input
            type="search"
            aria-label="Search orders"
            placeholder="Order #, name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={cn(control, 'w-full ps-8')}
          />
        </form>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setFilter({ status: e.target.value || undefined })}
          className={cn(control, 'flex-[1_1_9rem] sm:flex-none')}
        >
          <option value="">All statuses ({stats.data?.orderCount ?? '—'})</option>
          <option value="attention">Needs attention ({attention})</option>
          {ORDER_GROUPS.map((g) => (
            <optgroup key={g.id} label={g.label}>
              {statusesInGroup(g.id).length > 1 ? (
                <option value={`group:${g.id}`}>
                  All {g.label.toLowerCase()} ({groupCount(g.id)})
                </option>
              ) : null}
              {statusesInGroup(g.id).map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel(s)} ({count(s)})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          aria-label="Date"
          value={customDates ? 'custom' : (quickRange ?? '')}
          onChange={(e) => onRange(e.target.value)}
          className={cn(control, 'flex-[1_1_8rem] sm:flex-none')}
        >
          <option value="">Any date</option>
          {RANGES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
          <option value="custom">Custom…</option>
        </select>
        {customDates ? (
          <span className="flex min-w-0 items-center gap-1">
            <input
              type="date"
              aria-label="From"
              value={from}
              max={to || undefined}
              onChange={(e) => setFilter({ from: e.target.value || undefined })}
              className={cn(control, 'w-[9.5rem]')}
            />
            <span className="text-xs text-[var(--fg-muted)]">–</span>
            <input
              type="date"
              aria-label="To"
              value={to}
              min={from || undefined}
              onChange={(e) => setFilter({ to: e.target.value || undefined })}
              className={cn(control, 'w-[9.5rem]')}
            />
          </span>
        ) : null}
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setFilter({ sort: e.target.value || undefined })}
          className={cn(control, 'flex-[1_1_8rem] sm:flex-none')}
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {filtered ? (
          <button
            type="button"
            className="h-9 px-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
            onClick={() => {
              setCustomDates(false)
              setQ('')
              setParams(new URLSearchParams(sort ? { sort } : {}))
              setSelected(new Set())
            }}
          >
            Clear
          </button>
        ) : null}
      </div>

      {orders.isPending && !orders.data ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : orders.isError ? (
        <QueryErrorState onRetry={() => orders.refetch()} />
      ) : (
        <>
          {/* Phones */}
          <div className="md:hidden">
            <div className="flex items-center justify-between px-1 pb-1.5 text-xs text-[var(--fg-muted)]">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={allOnPage} onChange={toggleAll} disabled={!items.length} />
                Select all
              </label>
              <span>
                {total} order{total === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
              {items.map((o) => (
                <li
                  key={o._id}
                  className={cn('flex min-w-0 items-start gap-2.5 px-3 py-2.5', selected.has(o._id) && 'bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]')}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                    checked={selected.has(o._id)}
                    onChange={() => toggle(o._id)}
                    aria-label={`Select order ${o.orderNumber}`}
                  />
                  <Link to={`/admin/orders/${o._id}`} className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">#{o.orderNumber}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(o.pricing.total)}</span>
                    </div>
                    <p className="truncate text-xs text-[var(--fg-muted)]">
                      {customerName(o)} · {formatDate(o.createdAt)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <StatusBadge o={o} />
                      <PaymentBadge o={o} />
                    </div>
                  </Link>
                </li>
              ))}
              {!items.length ? <li className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">No orders found.</li> : null}
            </ul>
          </div>

          {/* Tablet / desktop */}
          <div className="hidden min-w-0 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs text-[var(--fg-muted)]">
                <tr>
                  <th className="w-9 py-2 ps-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--brand)]"
                      checked={allOnPage}
                      onChange={toggleAll}
                      aria-label="Select all on this page"
                      disabled={!items.length}
                    />
                  </th>
                  <th className="px-2 py-2 font-medium">Order</th>
                  <th className="px-2 py-2 font-medium">Customer</th>
                  <th className="px-2 py-2 font-medium">Date</th>
                  <th className="px-2 py-2 text-right font-medium">Total</th>
                  <th className="px-2 py-2 font-medium">Payment</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="whitespace-nowrap py-2 pe-3 text-right font-normal">
                    {total} order{total === 1 ? '' : 's'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {items.map((o) => (
                  <tr key={o._id} className={cn('hover:bg-[var(--bg-muted)]', selected.has(o._id) && 'bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]')}>
                    <td className="py-2 ps-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--brand)]"
                        checked={selected.has(o._id)}
                        onChange={() => toggle(o._id)}
                        aria-label={`Select order ${o.orderNumber}`}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Link to={`/admin/orders/${o._id}`} className="flex items-center gap-2 font-medium hover:text-[var(--brand-text)]">
                        {o.items?.[0] ? <OrderItemThumb item={o.items[0]} size="sm" className="h-8 w-8" /> : null}
                        <span className="whitespace-nowrap">#{o.orderNumber}</span>
                      </Link>
                    </td>
                    <td className="max-w-[12rem] px-2 py-2">
                      <p className="truncate">{customerName(o)}</p>
                      <p className="truncate text-xs text-[var(--fg-muted)]">{o.shippingAddress?.phone}</p>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-[var(--fg-muted)]" title={formatDateTime(o.createdAt)}>
                      {formatDate(o.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">{formatCurrency(o.pricing.total)}</td>
                    <td className="px-2 py-2">
                      <PaymentBadge o={o} />
                    </td>
                    <td className="px-2 py-2">
                      <StatusBadge o={o} />
                    </td>
                    <td className="py-2 pe-3">
                      <div className="flex justify-end">
                        <Button variant="ghost" size="sm" aria-label="Print delivery slip" title="Print delivery slip" onClick={() => printSlips([o._id])}>
                          <SiteIcon name="package" size={15} />
                        </Button>
                        <Button variant="ghost" size="sm" aria-label="Delete order" title="Delete order" onClick={() => setDeleteId(o._id)}>
                          <SiteIcon name="trash" size={15} />
                        </Button>
                        <Link
                          to={`/admin/orders/${o._id}`}
                          aria-label={`Open order ${o.orderNumber}`}
                          title="Open"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--fg)]"
                        >
                          <SiteIcon name="chevron-right" size={15} />
                        </Link>
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

      {/* Bulk bar: only the actions the selected orders allow */}
      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <button type="button" className="text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <div className="ms-auto flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" onClick={() => printSlips([...selected])}>
                <SiteIcon name="package" size={14} /> Slips
              </Button>
              {BULK_ACTIONS.map((a) =>
                eligible(a) ? (
                  <Button
                    key={a.status}
                    size="sm"
                    variant={a.danger ? 'ghost' : 'outline'}
                    className={a.danger ? 'text-[var(--danger)]' : undefined}
                    disabled={runBulk.isPending}
                    onClick={() => setBulk(a)}
                  >
                    {a.label}
                    {eligible(a) !== selected.size ? ` (${eligible(a)})` : ''}
                  </Button>
                ) : null
              )}
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(bulk)}
        title={bulk ? `${bulk.label}: ${eligible(bulk)} order${eligible(bulk) === 1 ? '' : 's'}?` : ''}
        description={
          bulk
            ? `Each order is updated as on its own page (stock, customer email, deposit checks).${
                selected.size - eligible(bulk) ? ` ${selected.size - eligible(bulk)} selected order(s) are skipped.` : ''
              } Orders that fail stay selected.`
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
