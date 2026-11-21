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
import { useAdminT } from '@/store/adminLangStore'
import type { AdminKey } from '@/i18n/admin'
import type { Order, OrderContactAttempt, OrderStatus } from '@/types'

const DANGER: OrderStatus[] = ['cancelled', 'delivery_failed']

/** When a status becomes available (shown on the greyed-out ones). */
const WHEN: Record<string, AdminKey> = {
  pending: 'order.whenPending',
  no_answer: 'order.whenNoAnswer',
  confirmed: 'order.whenConfirmed',
  shipped: 'order.whenShipped',
  delivery_failed: 'order.whenAfterShipped',
  rescheduled: 'order.whenAfterShipped',
  delivered: 'order.whenAfterShipped',
  return_requested: 'order.whenReturnRequested',
  return_in_transit: 'order.whenReturnInTransit',
  partially_returned: 'order.whenReturned',
  returned: 'order.whenReturned',
  cancelled: 'order.whenCancelled',
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
  const tr = useAdminT()
  const when = (s: OrderStatus) => (WHEN[s] ? tr(WHEN[s]) : '')
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
                    title={isCurrent ? tr('order.currentStatus') : reachable ? tr('order.moveTo', { status: orderStatusLabel(s) }) : blocked(s) || when(s)}
                    className={cn(
                      'flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-start text-xs',
                      isCurrent && 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] font-semibold',
                      reachable && 'border-[var(--border)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]',
                      !isCurrent && !reachable && 'cursor-not-allowed border-dashed border-[var(--border)] text-[var(--fg-muted)] opacity-70'
                    )}
                  >
                    <span className="truncate">{orderStatusLabel(s)}</span>
                    <span className="shrink-0 text-[10px] font-normal">
                      {isCurrent ? tr('order.now') : reachable ? tr('order.available') : viaReturns ? tr('order.viaReturns') : blocked(s) ? tr('order.depositFirst') : when(s)}
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
  const tr = useAdminT()
  const refresh = useInvalidateOrder(order._id)
  const current = order.orderStatus === 'processing' ? 'confirmed' : order.orderStatus
  // A rescheduled delivery can get a new date without changing status
  // A partly returned order offers "delivered" only if it was never delivered (cash not collected yet)
  const next: OrderStatus[] = [
    ...(ORDER_TRANSITIONS[current] ?? []).filter((s) => !(current === 'partially_returned' && s === 'delivered' && order.deliveredAt)),
    ...(current === 'rescheduled' ? (['rescheduled'] as OrderStatus[]) : []),
  ]
  const [target, setTarget] = useState<OrderStatus | null>(null)
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [staffNote, setStaffNote] = useState('')
  const [touched, setTouched] = useState(false)
  // Phones: the map of every status is long, so it opens on demand
  const [showMap, setShowMap] = useState(false)

  const awaitingDeposit = order.deposit?.status === 'pending'
  const blocked = (s: OrderStatus) => (s === 'confirmed' && awaitingDeposit ? tr('order.depositBlock') : '')

  const open = (s: OrderStatus) => {
    setTarget(s)
    setReason('')
    setDate(s === 'rescheduled' && order.rescheduledFor ? order.rescheduledFor.slice(0, 10) : '')
    setNote('')
    setStaffNote('')
    setTouched(false)
  }

  const errors = {
    reason: target === 'delivery_failed' && !reason ? tr('order.chooseReason') : undefined,
    date: target === 'rescheduled' && !date ? tr('order.chooseDate') : target === 'rescheduled' && date < todayInput() ? tr('order.todayOrLater') : undefined,
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
      toast.success(tr('order.statusSaved', { status: orderStatusLabel(o.orderStatus).toLowerCase() }))
      setTarget(null)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const returnable = RETURNABLE_STATUSES.includes(current)

  return (
    <Panel
      className="scroll-mt-20"
      id="order-status"
      title={tr('common.status')}
      description={tr('order.statusDesc')}
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
              {s === current ? tr('order.changeDate') : (TRANSITION_LABEL[s] ?? orderStatusLabel(s))}
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">
          {current === 'cancelled'
            ? tr('order.closed')
            : current === 'returned'
              ? tr('order.allBack')
              : current === 'return_in_transit'
                ? tr('order.waitingParcel')
                : tr('order.noFurther')}
        </p>
      )}

      {returnable && current !== 'return_in_transit' ? (
        <p className="mt-2 text-xs text-[var(--fg-muted)]">{tr('order.parcelBack')}</p>
      ) : null}
      <button
        type="button"
        onClick={() => setShowMap((v) => !v)}
        aria-expanded={showMap}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-text)] sm:hidden"
      >
        {showMap ? tr('order.hideStatuses') : tr('order.showStatuses')}
        <SiteIcon name="chevron-down" size={13} className={cn('transition', showMap && 'rotate-180')} />
      </button>
      <div className={cn(!showMap && 'max-sm:hidden')}>
        <StatusMap current={current} next={next} blocked={blocked} onPick={(s) => open(s)} />
      </div>

      {awaitingDeposit && next.includes('confirmed') ? (
        <p className="mt-2 text-xs text-[var(--warning)]">{tr('order.confirmNeedsDeposit')}</p>
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
              label={tr('order.whyFail')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={tr('order.chooseReason')}
              options={DELIVERY_ISSUES.map((d) => ({ value: d.value, label: d.label }))}
              error={touched ? errors.reason : undefined}
            />
          ) : null}
          {target === 'rescheduled' ? (
            <Input
              label={tr('order.newDate')}
              type="date"
              min={todayInput()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={touched ? errors.date : undefined}
            />
          ) : null}
          <Input
            label={tr('order.customerMsg')}
            maxLength={500}
            placeholder={target === 'cancelled' ? tr('order.customerMsgCancel') : tr('order.customerMsgDefault')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Textarea
            label={tr('order.staffNote')}
            rows={2}
            maxLength={1000}
            placeholder={target === 'no_answer' ? tr('order.staffNoteNoAnswer') : tr('order.staffNoteDefault')}
            value={staffNote}
            onChange={(e) => setStaffNote(e.target.value)}
          />
          {target === 'cancelled' && order.deposit?.status === 'received' ? (
            <p className="text-xs text-[var(--warning)]">{tr('order.depositReceivedCancel')}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={save.isPending} variant={DANGER.includes(target) ? 'danger' : 'primary'}>
              {tr('order.saveStatus', { status: orderStatusLabel(target) })}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setTarget(null)}>
              {tr('order.cancel')}
            </Button>
          </div>
        </form>
      ) : null}
    </Panel>
  )
}

/** Internal order note (never shown to the customer). */
export function OrderInternalNote({ order }: { order: Order }) {
  const tr = useAdminT()
  const refresh = useInvalidateOrder(order._id)
  const [value, setValue] = useState(order.adminNote || '')
  const dirty = value !== (order.adminNote || '')
  const save = useMutation({
    mutationFn: async () => (await adminApi.orders.updateStatus(order._id, { orderStatus: order.orderStatus, adminNote: value })).data.data,
    onSuccess: (o) => {
      refresh(o)
      toast.success(tr('order.noteSaved'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  return (
    <div className="space-y-2">
      <Textarea label={tr('order.internalNote')} rows={3} maxLength={5000} value={value} onChange={(e) => setValue(e.target.value)} />
      {dirty ? (
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          {tr('order.saveNote')}
        </Button>
      ) : null}
    </div>
  )
}

const CHANNELS: { value: OrderContactAttempt['channel']; key: AdminKey }[] = [
  { value: 'call', key: 'order.chCall' },
  { value: 'whatsapp', key: 'order.chWhatsapp' },
  { value: 'sms', key: 'order.chSms' },
  { value: 'email', key: 'order.chEmail' },
]

const OUTCOMES: { value: OrderContactAttempt['outcome']; key: AdminKey }[] = [
  { value: 'reached', key: 'order.outReached' },
  { value: 'no_answer', key: 'order.outNoAnswer' },
  { value: 'busy', key: 'order.outBusy' },
  { value: 'switched_off', key: 'order.outOff' },
  { value: 'wrong_number', key: 'order.outWrong' },
  { value: 'message_sent', key: 'order.outSent' },
]

/** Calls / messages to the customer: log and history. */
export function OrderContactLog({ order }: { order: Order }) {
  const tr = useAdminT()
  const label = <T extends string>(list: { value: T; key: AdminKey }[], v: T) => {
    const found = list.find((x) => x.value === v)
    return found ? tr(found.key) : v
  }
  const options = <T extends string>(list: { value: T; key: AdminKey }[]) => list.map((x) => ({ value: x.value, label: tr(x.key) }))
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
      toast.success(tr('order.contactSaved'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const failed = attempts.filter((a) => a.outcome !== 'reached' && a.outcome !== 'message_sent').length

  return (
    <Panel
      title={tr('order.contactTitle')}
      description={
        attempts.length
          ? attempts.length === 1
            ? tr('order.contactAttemptOne', { failed })
            : tr('order.contactAttempts', { count: attempts.length, failed })
          : tr('order.contactHint')
      }
      compact
    >
      <form
        className="grid gap-2 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          save.mutate()
        }}
      >
        <Select aria-label={tr('order.channel')} value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} options={options(CHANNELS)} />
        <Select aria-label={tr('order.outcome')} value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} options={options(OUTCOMES)} />
        <Input aria-label={tr('order.note')} placeholder={tr('order.noteOptional')} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" size="sm" loading={save.isPending}>
          {tr('order.log')}
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
  const tr = useAdminT()
  const steps = [...order.timeline].reverse()
  return (
    <Panel title={tr('order.history')} description={tr('order.historyDesc')} compact>
      <ol className="space-y-3 text-sm">
        {steps.map((t, i) => (
          <li key={i} className={cn('relative min-w-0 border-s-2 ps-3', t.internal ? 'border-[var(--border)] opacity-80' : 'border-[var(--brand)]')}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Badge variant={orderStatusVariant(t.status)}>{orderStatusLabel(t.status)}</Badge>
              {t.reason ? <span className="text-xs font-medium">{deliveryIssueLabel(t.reason)}</span> : null}
              {t.internal ? <span className="text-[11px] uppercase tracking-wide text-[var(--fg-muted)]">{tr('order.staffOnly')}</span> : null}
            </div>
            {t.note ? <p className="mt-1 break-words">{t.note}</p> : null}
            {t.staffNote ? <p className="mt-0.5 break-words text-xs text-[var(--fg-muted)]">{tr('order.staffPrefix', { note: t.staffNote })}</p> : null}
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
