import { useEffect, useState } from 'react'
import { MANUAL_ORDER_ORIGINS, ORDER_ORIGIN_LABEL, originOf } from '@/lib/orderOrigin'
import { RecordDepositDialog } from '@/components/admin/RecordDepositDialog'
import { DepositsView, OrdersTabs } from '@/components/admin/DepositsView'
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
import { customerWhatsAppHref, telHref } from '@/lib/customerContact'
import { timeAgo } from '@/api/teamActivityApi'

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

/** The usual next step of an order, for the quick button on phones (null when it needs details). */
function quickNext(o: Order): { status: OrderStatus; label: string } | null {
  const depositDue = o.deposit?.status === 'pending' && (o.deposit.amount || 0) > 0
  if ((o.orderStatus === 'pending' || o.orderStatus === 'no_answer') && !depositDue) return { status: 'confirmed', label: 'Confirm' }
  if (o.orderStatus === 'confirmed') return { status: 'shipped', label: 'Mark shipped' }
  if (['shipped', 'rescheduled', 'delivery_failed'].includes(o.orderStatus)) return { status: 'delivered', label: 'Mark delivered' }
  return null
}

/** Status chips on phones (instead of the status list): only the ones with orders, plus the chosen one. */
const PHONE_STATUS_CHIPS: { value: string; label: string; statuses?: OrderStatus[] }[] = [
  { value: 'pending', label: 'New', statuses: ['pending'] },
  { value: 'no_answer', label: 'No answer', statuses: ['no_answer'] },
  { value: 'confirmed', label: 'Confirmed', statuses: ['confirmed'] },
  { value: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { value: 'rescheduled', label: 'Rescheduled', statuses: ['rescheduled'] },
  { value: 'delivery_failed', label: 'Failed', statuses: ['delivery_failed'] },
  { value: 'delivered', label: 'Delivered', statuses: ['delivered'] },
  { value: 'group:returns', label: 'Returns', statuses: statusesInGroup('returns') },
  { value: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
]

const phoneAction =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-xs font-medium text-[var(--fg)] active:bg-[var(--bg-muted)]'

/** One order on a phone: who, where, how much, and the buttons to deal with it. */
function PhoneOrderCard({
  o,
  selected,
  onToggle,
  onNext,
  busy,
}: {
  o: Order
  selected: boolean
  onToggle: () => void
  onNext: (status: OrderStatus) => void
  busy: boolean
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  const next = quickNext(o)
  const phone = o.shippingAddress?.phone
  const tel = telHref(phone)
  const wa = customerWhatsAppHref(phone, customerName(o), o.orderNumber)
  return (
    <li className={cn('min-w-0 px-3 py-3', selected && 'bg-[color-mix(in_srgb,var(--brand)_6%,transparent)]')}>
      <div className="flex min-w-0 items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-3.5 h-4 w-4 shrink-0 accent-[var(--brand)]"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select order ${o.orderNumber}`}
        />
        <Link to={`/admin/orders/${o._id}`} className="flex min-w-0 flex-1 items-start gap-2.5">
          {o.items?.[0] ? <OrderItemThumb item={o.items[0]} size="sm" className="h-11 w-11 shrink-0" /> : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="truncate text-[15px] font-semibold">{customerName(o)}</span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">{formatCurrency(o.pricing.total)}</span>
            </div>
            <p className="truncate text-xs text-[var(--fg-muted)]">
              {[o.shippingAddress?.city, timeAgo(o.createdAt), `#${o.orderNumber.split('-').pop()}`].filter(Boolean).join(' · ')}
              {o.items?.length > 1 ? ` · ${o.items.reduce((a, i) => a + i.qty, 0)} items` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <StatusBadge o={o} />
              <PaymentBadge o={o} />
              <OriginBadge o={o} />
            </div>
          </div>
        </Link>
      </div>
      <div className="mt-2.5 flex gap-2 ps-[1.6rem]">
        {tel ? (
          <a href={tel} className={phoneAction} aria-label={`Call ${customerName(o)}`}>
            <SiteIcon name="phone" size={14} /> Call
          </a>
        ) : null}
        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={phoneAction} aria-label={`WhatsApp ${customerName(o)}`}>
            <SiteIcon name="chat" size={14} /> WhatsApp
          </a>
        ) : null}
        {next ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!armed) return setArmed(true)
              setArmed(false)
              onNext(next.status)
            }}
            className={cn(
              'inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-60',
              armed ? 'bg-[var(--warning)] text-black' : 'bg-[var(--brand)] text-[var(--brand-fg)]'
            )}
          >
            {busy ? <Spinner size="sm" /> : <SiteIcon name="check" size={14} />}
            <span className="truncate">{armed ? 'Tap again to confirm' : next.label}</span>
          </button>
        ) : (
          <Link to={`/admin/orders/${o._id}`} className={cn(phoneAction, 'flex-1')}>
            Open
          </Link>
        )}
      </div>
    </li>
  )
}

/** Admin → Orders: the order list, or Deposits & payments (?view=deposits). */
export function Orders() {
  const [params] = useSearchParams()
  return params.get('view') === 'deposits' ? <DepositsView /> : <OrdersList />
}

/** Small tag on orders that did not come from the website (Instagram, the shop…). */
function OriginBadge({ o }: { o: Order }) {
  const from = originOf(o)
  if (from === 'website') return null
  return (
    <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-1.5 py-px text-[10px] font-medium text-[var(--brand-text)]">
      {ORDER_ORIGIN_LABEL[from]}
    </span>
  )
}

function OrdersList() {
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
  const origin = params.get('origin') || ''
  const [q, setQ] = useState(params.get('q') || '')
  const page = Number(params.get('page') || 1)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Phones: date / source / sort are tucked behind a button
  const [moreFilters, setMoreFilters] = useState(false)
  const [bulk, setBulk] = useState<(typeof BULK_ACTIONS)[number] | null>(null)

  const quickRange = !to ? RANGES.find((r) => r.from() === from)?.id : undefined
  const [customDates, setCustomDates] = useState(Boolean((from || to) && !quickRange))

  useEffect(() => {
    setQ(params.get('q') || '')
  }, [params])

  const orders = useQuery({
    queryKey: ['admin-orders', { page, status, q: params.get('q') || '', from, to, sort, origin }],
    queryFn: async () => {
      const res = await adminApi.orders.list({
        page,
        limit: 20,
        status: status || undefined,
        q: params.get('q') || undefined,
        from: from || undefined,
        to: to || undefined,
        sort: sort || undefined,
        origin: origin || undefined,
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

  // Phones: the quick next-step button on each order
  const quickStatus = useMutation({
    mutationFn: (v: { id: string; status: OrderStatus }) => adminApi.orders.updateStatus(v.id, { orderStatus: v.status }),
    onSuccess: (_r, v) => {
      refresh()
      toast.success(`Order ${orderStatusLabel(v.status).toLowerCase()}`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

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
  const filtered = Boolean(status || params.get('q') || from || to || origin)

  return (
    <div className={cn('min-w-0 space-y-3', selected.size > 0 && 'pb-20')}>
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-lg font-semibold tracking-tight sm:text-xl">Orders</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          to="/admin/orders/new"
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[var(--brand)] px-3 text-xs font-semibold text-[var(--brand-fg)] hover:opacity-90"
        >
          <SiteIcon name="plus" size={13} /> New order
        </Link>
        <button
          type="button"
          onClick={() => setRecording(true)}
          aria-label="Record deposit"
          title="Record deposit"
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 text-xs font-medium text-[var(--brand-text)] hover:border-[var(--brand)] sm:px-3"
        >
          <SiteIcon name="banknote" size={13} /> <span className="hidden sm:inline">Record deposit</span>
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
            {attention}
            <span className="hidden sm:inline"> need{attention === 1 ? 's' : ''} attention</span>
          </button>
        ) : null}
        </div>
      </div>
      <OrdersTabs />
      <RecordDepositDialog open={recording} onClose={() => setRecording(false)} />

      {/* Phones: status chips instead of the status list */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 md:hidden" role="tablist" aria-label="Status">
        {[{ value: '', label: 'All', n: stats.data?.orderCount }, ...(attention ? [{ value: 'attention', label: 'To do', n: attention }] : []), ...PHONE_STATUS_CHIPS.map((c) => ({ value: c.value, label: c.label, n: (c.statuses ?? []).reduce((a, st) => a + count(st), 0) }))]
          .filter((c) => c.value === '' || c.value === status || (c.n ?? 0) > 0)
          .map((c) => (
            <button
              key={c.value || 'all'}
              type="button"
              role="tab"
              aria-selected={status === c.value}
              onClick={() => setFilter({ status: c.value || undefined })}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium',
                status === c.value
                  ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)]'
                  : c.value === 'attention'
                    ? 'border-[color-mix(in_srgb,var(--warning)_50%,transparent)] text-[var(--warning)]'
                    : 'border-[var(--border)] text-[var(--fg-muted)]'
              )}
            >
              {c.label}
              {c.n !== undefined ? <span className="tabular-nums opacity-80">{c.n}</span> : null}
            </button>
          ))}
      </div>

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
            className={cn(control, 'w-full ps-8 pe-24 md:pe-2.5')}
          />
          <button
            type="button"
            onClick={() => setMoreFilters((v) => !v)}
            aria-expanded={moreFilters}
            className="absolute end-1 top-1/2 inline-flex h-7 -translate-y-1/2 items-center gap-1 rounded-md px-2 text-xs font-medium text-[var(--brand-text)] md:hidden"
          >
            <SiteIcon name="sliders" size={13} /> Filters
            {[from || to, params.get('origin'), sort].filter(Boolean).length ? (
              <span className="rounded-full bg-[var(--brand)] px-1.5 text-[10px] text-[var(--brand-fg)]">{[from || to, params.get('origin'), sort].filter(Boolean).length}</span>
            ) : null}
          </button>
        </form>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => setFilter({ status: e.target.value || undefined })}
          className={cn(control, 'hidden flex-[1_1_9rem] sm:flex-none md:block')}
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
          className={cn(control, 'flex-[1_1_8rem] sm:flex-none', !moreFilters && 'hidden md:block')}
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
          aria-label="Source"
          value={origin}
          onChange={(e) => setFilter({ origin: e.target.value || undefined })}
          className={cn(control, 'flex-[1_1_8rem] sm:flex-none', !moreFilters && 'hidden md:block')}
        >
          <option value="">All sources</option>
          <option value="website">Website</option>
          <option value="other_channels">Social media, phone & shop</option>
          {MANUAL_ORDER_ORIGINS.map((o) => (
            <option key={o} value={o}>
              {ORDER_ORIGIN_LABEL[o]}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => setFilter({ sort: e.target.value || undefined })}
          className={cn(control, 'flex-[1_1_8rem] sm:flex-none', !moreFilters && 'hidden md:block')}
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
                <PhoneOrderCard
                  key={o._id}
                  o={o}
                  selected={selected.has(o._id)}
                  onToggle={() => toggle(o._id)}
                  busy={quickStatus.isPending && quickStatus.variables?.id === o._id}
                  onNext={(st) => quickStatus.mutate({ id: o._id, status: st })}
                />
              ))}
              {!items.length ? <li className="px-4 py-6 text-center text-sm text-[var(--fg-muted)]">No orders found.</li> : null}
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
                      <p className="flex min-w-0 items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                        <span className="truncate">{o.shippingAddress?.phone}</span>
                        <OriginBadge o={o} />
                      </p>
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
                    <td colSpan={8} className="px-4 py-6 text-center text-sm text-[var(--fg-muted)]">
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
