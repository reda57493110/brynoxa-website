import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Panel } from '@/components/admin/Panel'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  DELIVERY_ISSUES,
  GROUP_DOT,
  ORDER_GROUPS,
  statusesInGroup,
  ORDER_TRANSITIONS,
  RETURNABLE_STATUSES,
  TRANSITION_LABEL,
  deliveryIssueLabel,
  orderStatusLabel,
  orderStatusVariant,
} from '@/lib/orderStatus'
import { toast } from '@/store/toastStore'
import type { Order, OrderContactAttempt, OrderStatus } from '@/types'

const DANGER: OrderStatus[] = ['cancelled', 'delivery_failed']

/** When a status becomes available (shown on the greyed-out ones). */
const WHEN: Record<string, string> = {
  pending: 'New orders start here',
  no_answer: 'From Pending',
  confirmed: 'From Pending / No answer',
  shipped: 'After Confirmed',
  delivery_failed: 'After Shipped',
  rescheduled: 'After Shipped',
  delivered: 'After Shipped',
  return_requested: 'After Delivered',
  return_in_transit: 'After Shipped or Delivered',
  partially_returned: 'Register returned items',
  returned: 'Register returned items',
  cancelled: 'Before shipping',
}

/**
 * Every status of the workflow, grouped: the current one highlighted, the ones reachable now
 * clickable, the rest greyed out with when they become available.
 */
function StatusMap({
  current,
  next,
  onPick,
  blocked,
}: {
  current: OrderStatus
  next: OrderStatus[]
  onPick: (s: OrderStatus) => void
  blocked: (s: OrderStatus) => string
}) {
  return (
    <div className="mt-4 grid gap-3 border-t border-[var(--border)] pt-3 sm:grid-cols-2 xl:grid-cols-5">
      {ORDER_GROUPS.map((g) => (
        <div key={g.id} className="min-w-0">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">
            <span className={cn('h-2 w-2 rounded-full', GROUP_DOT[g.id])} /> {g.label}
          </p>
          <ul className="space-y-1">
            {statusesInGroup(g.id).map((s) => {
              const isCurrent = s === current
              const reachable = !isCurrent && next.includes(s) && !blocked(s)
              const viaReturns = s === 'returned' || s === 'partially_returned'
              return (
                <li key={s}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => onPick(s)}
                    title={isCurrent ? 'Current status' : reachable ? `Move to ${orderStatusLabel(s)}` : blocked(s) || WHEN[s]}
                    className={cn(
                      'flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-start text-xs',
                      isCurrent && 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] font-semibold',
                      reachable && 'border-[var(--border)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]',
                      !isCurrent && !reachable && 'cursor-not-allowed border-dashed border-[var(--border)] text-[var(--fg-muted)] opacity-70'
                    )}
                  >
                    <span className="truncate">{orderStatusLabel(s)}</span>
                    <span className="shrink-0 text-[10px] font-normal">
                      {isCurrent ? 'Now' : reachable ? 'Available' : viaReturns ? 'Via returns' : blocked(s) ? 'Deposit first' : WHEN[s]}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function personName(by: unknown) {
  return by && typeof by === 'object' && 'name' in by ? String((by as { name: string }).name) : ''
}

function todayInput() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date())
}

function useInvalidateOrder(id: string) {
  const qc = useQueryClient()
  return (order?: Order) => {
    if (order) qc.setQueryData(['admin-order', id], order)
    qc.invalidateQueries({ queryKey: ['admin-order', id] })
    qc.invalidateQueries({ queryKey: ['admin-orders'] })
    qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
  }
}

/** Next-step buttons for the current status (only valid moves), each with the details it needs. */
export function OrderStatusActions({ order }: { order: Order }) {
  const refresh = useInvalidateOrder(order._id)
  const current = order.orderStatus === 'processing' ? 'confirmed' : order.orderStatus
  // A rescheduled delivery can get a new date without changing status
  const next: OrderStatus[] = [...(ORDER_TRANSITIONS[current] ?? []), ...(current === 'rescheduled' ? (['rescheduled'] as OrderStatus[]) : [])]
  const [target, setTarget] = useState<OrderStatus | null>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [touched, setTouched] = useState(false)
  // Phones: the map of every status is long, so it opens on demand
  const [showMap, setShowMap] = useState(false)

  const awaitingDeposit = order.deposit?.status === 'pending'
  const blocked = (s: OrderStatus) => (s === 'confirmed' && awaitingDeposit ? 'Mark the deposit as received first' : '')

  const open = (s: OrderStatus) => {
    setTarget(s)
    setReason('')
    setDate(s === 'rescheduled' && order.rescheduledFor ? order.rescheduledFor.slice(0, 10) : '')
    setNote('')
    setStaffNote('')
    setTouched(false)
  }

  const errors = {
    reason: target === 'delivery_failed' && !reason ? 'Choose a reason' : undefined,
    date: target === 'rescheduled' && !date ? 'Choose the new date' : target === 'rescheduled' && date < todayInput() ? 'Pick today or later' : undefined,
  }

  const save = useMutation({
    mutationFn: async () =>
      (
        await adminApi.orders.updateStatus(order._id, {
          orderStatus: target!,
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(staffNote.trim() ? { staffNote: staffNote.trim() } : {}),
          ...(reason ? { reason } : {}),
          ...(date ? { rescheduledFor: date } : {}),
        })
      ).data.data,
    onSuccess: (o) => {
      refresh(o)
      toast.success(`Order ${orderStatusLabel(o.orderStatus).toLowerCase()}`)
      setTarget(null)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const returnable = RETURNABLE_STATUSES.includes(current)

  return (
    <Panel
      className="scroll-mt-20"
      id="order-status"
      title="Status"
      description="Buttons = what you can do now. The map below shows every status and when it unlocks. Stock and payment follow automatically."
      compact
      actions={<Badge variant={orderStatusVariant(current)}>{orderStatusLabel(current)}</Badge>}
    >
      {next.length ? (
        <div className="flex flex-wrap gap-2">
          {next.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={target === s ? 'primary' : DANGER.includes(s) ? 'danger' : 'secondary'}
              disabled={Boolean(blocked(s))}
              title={blocked(s) || undefined}
              onClick={() => (target === s ? setTarget(null) : open(s))}
            >
              {s === current ? 'Change date' : (TRANSITION_LABEL[s] ?? orderStatusLabel(s))}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">
          {current === 'cancelled'
            ? 'This order is closed.'
            : current === 'returned'
              ? 'Everything came back. Assess the units in Inventory → Returns and settle any refund.'
              : current === 'return_in_transit'
                ? 'Waiting for the parcel. Register what arrives under Returned items.'
                : 'No further status change.'}
        </p>
      )}

      {returnable && current !== 'return_in_transit' ? (
        <p className="mt-2 text-xs text-[var(--fg-muted)]">Parcel back in the shop? Register it under Returned items — the status updates itself.</p>
      ) : null}
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        aria-expanded={showMap}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-text)] sm:hidden"
      >
        {showMap ? 'Hide all statuses' : 'Show all statuses'}
        <SiteIcon name="chevron-down" size={13} className={cn('transition', showMap && 'rotate-180')} />
      </button>
      <div className={cn(!showMap && 'max-sm:hidden')}>
        <StatusMap current={current} next={next} blocked={blocked} onPick={(s) => open(s)} />
      </div>

      {awaitingDeposit && next.includes('confirmed') ? (
        <p className="mt-2 text-xs text-[var(--warning)]">Confirming needs the deposit marked as received.</p>
      ) : null}

      {target ? (
        <form
          className="mt-3 space-y-3 rounded-lg border border-[var(--border)] p-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (!errors.reason && !errors.date) save.mutate()
          }}
        >
          <p className="text-sm font-medium">
            {orderStatusLabel(current)} → {orderStatusLabel(target)}
          </p>
          {target === 'delivery_failed' ? (
            <Select
              label="Why did it fail?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Choose a reason"
              options={DELIVERY_ISSUES.map((d) => ({ value: d.value, label: d.label }))}
              error={touched ? errors.reason : undefined}
            />
          ) : null}
          {target === 'rescheduled' ? (
            <Input
              label="New delivery date"
              type="date"
              min={todayInput()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={touched ? errors.date : undefined}
            />
          ) : null}
          <Input
            label="Message on the customer's order history (optional)"
            maxLength={500}
            placeholder={target === 'cancelled' ? 'e.g. Out of stock — sorry!' : 'Leave empty for the standard text'}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Textarea
            label="Staff note (internal)"
            rows={2}
            maxLength={1000}
            placeholder={target === 'no_answer' ? 'e.g. Called twice, voicemail' : 'Courier name, what the customer said…'}
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
          />
          {target === 'cancelled' && order.deposit?.status === 'received' ? (
            <p className="text-xs text-[var(--warning)]">The deposit was received: record the refund under Refunds once it is paid back.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={save.isPending} variant={DANGER.includes(target) ? 'danger' : 'primary'}>
              Save: {orderStatusLabel(target)}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </Panel>
  )
}

/** Internal order note (never shown to the customer). */
export function OrderInternalNote({ order }: { order: Order }) {
  const refresh = useInvalidateOrder(order._id)
  const [value, setValue] = useState(order.adminNote || '')
  const dirty = value !== (order.adminNote || '')
  const save = useMutation({
    mutationFn: async () => (await adminApi.orders.updateStatus(order._id, { orderStatus: order.orderStatus, adminNote: value })).data.data,
    onSuccess: (o) => {
      refresh(o)
      toast.success('Note saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <div className="space-y-2">
      <Textarea label="Internal note" rows={3} maxLength={5000} value={value} onChange={(e) => setValue(e.target.value)} />
      {dirty ? (
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          Save note
        </Button>
      ) : null}
    </div>
  )
}

const CHANNELS: { value: OrderContactAttempt['channel']; label: string }[] = [
  { value: 'call', label: 'Phone call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
]

const OUTCOMES: { value: OrderContactAttempt['outcome']; label: string }[] = [
  { value: 'reached', label: 'Reached' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'switched_off', label: 'Phone off' },
  { value: 'wrong_number', label: 'Wrong number' },
  { value: 'message_sent', label: 'Message sent' },
]

const label = <T extends string>(list: { value: T; label: string }[], v: T) => list.find((x) => x.value === v)?.label ?? v

/** Calls / messages to the customer: log and history. */
export function OrderContactLog({ order }: { order: Order }) {
  const refresh = useInvalidateOrder(order._id)
  const [channel, setChannel] = useState<OrderContactAttempt['channel']>('call')
  const [outcome, setOutcome] = useState<OrderContactAttempt['outcome']>('no_answer')
  const [note, setNote] = useState('')
  const attempts = [...(order.contactAttempts || [])].reverse()

  const save = useMutation({
    mutationFn: async () => (await adminApi.orders.logContact(order._id, { channel, outcome, ...(note.trim() ? { note: note.trim() } : {}) })).data.data,
    onSuccess: (o) => {
      refresh(o)
      setNote('')
      toast.success('Contact attempt saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const failed = attempts.filter((a) => a.outcome !== 'reached' && a.outcome !== 'message_sent').length

  return (
    <Panel
      title="Customer contact"
      description={attempts.length ? `${attempts.length} attempt${attempts.length === 1 ? '' : 's'}, ${failed} unanswered` : 'Log each call or message.'}
      compact
    >
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <Select aria-label="Channel" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} options={CHANNELS} />
        <Select aria-label="Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} options={OUTCOMES} />
        <Input aria-label="Note" placeholder="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" size="sm" loading={save.isPending}>
          Log
        </Button>
      </form>
      {attempts.length ? (
        <ul className="mt-3 divide-y divide-[var(--border)] text-sm">
          {attempts.map((a, i) => (
            <li key={i} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5">
              <span className="min-w-0">
                <span className={cn('font-medium', a.outcome === 'reached' ? 'text-[var(--success)]' : a.outcome === 'message_sent' ? '' : 'text-[var(--warning)]')}>
                  {label(OUTCOMES, a.outcome)}
                </span>{' '}
                <span className="text-[var(--fg-muted)]">· {label(CHANNELS, a.channel)}</span>
                {a.note ? <span className="block break-words text-xs text-[var(--fg-muted)]">{a.note}</span> : null}
              </span>
              <span className="shrink-0 text-xs text-[var(--fg-muted)]">
                {formatDateTime(a.at)}
                {personName(a.by) ? ` · ${personName(a.by)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  )
}

/** Full status history with who did what; staff-only steps and notes are marked. */
export function OrderHistory({ order }: { order: Order }) {
  const steps = [...order.timeline].reverse()
  return (
    <Panel title="History" description="Newest first. Grey items are staff-only." compact>
      <ol className="space-y-3 text-sm">
        {steps.map((t, i) => (
          <li key={i} className={cn('relative min-w-0 border-s-2 ps-3', t.internal ? 'border-[var(--border)] opacity-80' : 'border-[var(--brand)]')}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant={orderStatusVariant(t.status)}>{orderStatusLabel(t.status)}</Badge>
              {t.reason ? <span className="text-xs font-medium">{deliveryIssueLabel(t.reason)}</span> : null}
              {t.internal ? <span className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">Staff only</span> : null}
            </div>
            {t.note ? <p className="mt-1 break-words">{t.note}</p> : null}
            {t.staffNote ? <p className="mt-0.5 break-words text-xs text-[var(--fg-muted)]">Staff: {t.staffNote}</p> : null}
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              {formatDateTime(t.at)}
              {personName(t.by) ? ` · ${personName(t.by)}` : ''}
            </p>
          </li>
        ))}
      </ol>
    </Panel>
  )
}
