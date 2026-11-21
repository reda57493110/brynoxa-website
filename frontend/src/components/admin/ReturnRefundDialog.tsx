import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, type ReturnRefundPayload } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency, formatDate } from '@/lib/format'
import { refundedTotal } from '@/lib/orderStatus'
import { orderProductId as productId, paidOn } from '@/lib/returnRefund'
import { hasPermission } from '@/lib/permissions'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { toast } from '@/store/toastStore'
import type { Order } from '@/types'
import { useAdminT } from '@/store/adminLangStore'
import type { AdminKey } from '@/i18n/admin'

/** The shop's return period (Terms of sale); later returns are warranty cases. */
const RETURN_DAYS = 14
const DAY_MS = 24 * 60 * 60 * 1000
const round2 = (n: number) => Math.round(n * 100) / 100

const REASONS: { value: ReturnRefundPayload['reason']; label: AdminKey }[] = [
  { value: 'defective', label: 'order.rrDefective' },
  { value: 'wrong-item', label: 'order.rrWrongItem' },
  { value: 'changed-mind', label: 'order.rrChangedMind' },
]
const METHODS: { value: ReturnRefundPayload['method']; label: AdminKey }[] = [
  { value: 'cash', label: 'order.rrCash' },
  { value: 'transfer', label: 'order.methodBank' },
  { value: 'other', label: 'order.other' },
]

/**
 * "Return & refund": a delivered sale undone in one step — pick the products that come back,
 * the money given back and what happens to the product; the server registers the return, the
 * refund and the stock move together (POST /admin/orders/:id/return-refund).
 */
export function ReturnRefundDialog({ order, open, onClose }: { order: Order; open: boolean; onClose: () => void }) {
  const tr = useAdminT()
  const qc = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const canWriteOff = hasPermission(role, 'inventory:approve')

  const lines = useMemo(
    () =>
      order.items
        .map((item) => ({ item, id: productId(item.product), left: item.qty - (item.returnedQty ?? 0) }))
        .filter((l) => l.left > 0),
    [order.items]
  )
  const refundable = round2(Math.max(0, paidOn(order) - refundedTotal(order)))

  // Quantity per product (0 = stays with the customer); serial numbers when the sale recorded them
  const [qty, setQty] = useState<Record<string, number>>({})
  const [serials, setSerials] = useState<Record<string, string[]>>({})
  const [reason, setReason] = useState<ReturnRefundPayload['reason']>('defective')
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [amountEdited, setAmountEdited] = useState(false)
  const [method, setMethod] = useState<ReturnRefundPayload['method']>('cash')
  const [outcome, setOutcome] = useState<ReturnRefundPayload['outcome']>('inspect')

  // Fresh form each time it opens: everything left on the order selected
  useEffect(() => {
    if (!open) return
    setQty(Object.fromEntries(lines.map((l) => [l.id, l.left])))
    setSerials(Object.fromEntries(lines.map((l) => [l.id, (l.item.serials ?? []).slice(0, l.left)])))
    setReason('defective')
    setNote('')
    setAmountEdited(false)
    setMethod('cash')
    setOutcome('inspect')
  }, [open, lines])

  const hasSerials = (l: (typeof lines)[number]) => (l.item.serials?.length ?? 0) > 0
  const qtyOf = (l: (typeof lines)[number]) => (hasSerials(l) ? (serials[l.id]?.length ?? 0) : (qty[l.id] ?? 0))
  const chosen = lines.filter((l) => qtyOf(l) > 0)
  const value = round2(chosen.reduce((a, l) => a + l.item.price * qtyOf(l), 0))
  const suggested = round2(Math.min(value, refundable))

  // The money back follows the products picked until it is typed by hand
  useEffect(() => {
    if (!amountEdited) setAmount(suggested ? String(suggested) : '0')
  }, [suggested, amountEdited])

  const deliveredAt = order.deliveredAt ? new Date(order.deliveredAt) : null
  const daysSince = deliveredAt ? Math.floor((Date.now() - deliveredAt.getTime()) / DAY_MS) : null
  const lateReturn = daysSince !== null && daysSince > RETURN_DAYS

  const parsed = Number(amount)
  const amountError =
    amount.trim() === '' || !Number.isFinite(parsed) || parsed < 0
      ? tr('order.enterZeroOrMore')
      : parsed > refundable + 0.005
        ? tr('order.rrAtMost', { amount: formatCurrency(refundable) })
        : undefined

  const submit = useMutation({
    mutationFn: () =>
      adminApi.orders.returnRefund(order._id, {
        lines: chosen.map((l) => ({
          productId: l.id,
          qty: qtyOf(l),
          ...(hasSerials(l) ? { serials: serials[l.id] } : {}),
        })),
        reason,
        note: note.trim() || undefined,
        amount: round2(parsed),
        method,
        outcome,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', order._id] })
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      qc.invalidateQueries({ queryKey: ['admin-customer'] })
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      qc.invalidateQueries({ queryKey: ['admin-profit'] })
      toast.success(parsed > 0 ? tr('order.rrDone', { amount: formatCurrency(parsed) }) : tr('order.rrRecorded'))
      onClose()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const radio = (on: boolean) =>
    cn(
      'flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition',
      on ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)] font-medium' : 'border-[var(--border)] hover:border-[var(--brand)]'
    )
  const customer = typeof order.user === 'object' && order.user ? order.user.name : order.shippingAddress?.fullName

  return (
    <Modal open={open} onClose={onClose} title={tr('order.returnRefund')} size="lg">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          if (!chosen.length || amountError) return
          submit.mutate()
        }}
      >
        <p className="text-sm text-[var(--fg-muted)]">
          {tr('common.order')} <span className="font-medium text-[var(--fg)]">#{order.orderNumber}</span>
          {customer ? <> · {customer}</> : null}
          {deliveredAt ? <> · {tr('order.rrDelivered', { date: formatDate(order.deliveredAt!) })}</> : null}
        </p>

        {lateReturn ? (
          <p className="flex gap-2 rounded-xl bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] px-3 py-2.5 text-sm text-[var(--warning)]">
            <SiteIcon name="alert" size={16} className="mt-0.5 shrink-0" />
            {tr('order.rrLate', { days: daysSince ?? 0, limit: RETURN_DAYS })}
          </p>
        ) : null}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{tr('order.rrProducts')}</legend>
          <ul className="space-y-2">
            {lines.map((l) => (
              <li key={l.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex min-w-0 flex-1 items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-[var(--brand)]"
                      checked={qtyOf(l) > 0}
                      onChange={(e) => {
                        if (hasSerials(l)) setSerials((s) => ({ ...s, [l.id]: e.target.checked ? (l.item.serials ?? []).slice(0, l.left) : [] }))
                        else setQty((q) => ({ ...q, [l.id]: e.target.checked ? l.left : 0 }))
                      }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{l.item.name}</span>
                      <span className="text-xs text-[var(--fg-muted)]">{tr('order.rrEach', { price: formatCurrency(l.item.price) })}</span>
                    </span>
                  </label>
                  {hasSerials(l) ? null : (
                    <label className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
                      {tr('order.rrQty')}
                      <select
                        className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 text-sm text-[var(--fg)]"
                        value={qty[l.id] ?? 0}
                        onChange={(e) => setQty((q) => ({ ...q, [l.id]: Number(e.target.value) }))}
                      >
                        {Array.from({ length: l.left + 1 }, (_, n) => (
                          <option key={n} value={n}>
                            {tr('order.rrOf', { n, max: l.left })}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {hasSerials(l) ? (
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={tr('order.rrSerialsOf', { name: l.item.name })}>
                    {(l.item.serials ?? []).map((sn) => {
                      const on = serials[l.id]?.includes(sn) ?? false
                      return (
                        <button
                          key={sn}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setSerials((s) => {
                              const list = s[l.id] ?? []
                              return { ...s, [l.id]: on ? list.filter((x) => x !== sn) : list.length < l.left ? [...list, sn] : list }
                            })
                          }
                          className={cn('rounded-lg border px-2 py-1 font-mono text-xs', on ? 'border-[var(--brand)] bg-[color-mix(in_srgb,var(--brand)_10%,transparent)]' : 'border-[var(--border)] text-[var(--fg-muted)]')}
                        >
                          {sn}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{tr('order.rrWhy')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {REASONS.map((r) => (
              <label key={r.value} className={radio(reason === r.value)}>
                <input type="radio" name="rr-reason" className="accent-[var(--brand)]" checked={reason === r.value} onChange={() => setReason(r.value)} />
                {tr(r.label)}
              </label>
            ))}
          </div>
          <input
            className="mt-2 h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 text-sm"
            placeholder={tr('order.rrNotePh')}
            maxLength={250}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label={tr('order.note')}
          />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rr-amount" className="mb-2 block text-sm font-semibold">
              {tr('order.rrMoneyBack')}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="rr-amount"
                inputMode="decimal"
                className={cn('h-10 w-full rounded-xl border bg-[var(--bg)] px-3 text-sm tabular-nums', amountError ? 'border-[var(--danger)]' : 'border-[var(--border)]')}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value)
                  setAmountEdited(true)
                }}
              />
              <span className="text-sm text-[var(--fg-muted)]">DH</span>
            </div>
            <p className={cn('mt-1 text-xs', amountError ? 'text-[var(--danger)]' : 'text-[var(--fg-muted)]')}>
              {amountError ?? tr('order.rrSuggested', { amount: formatCurrency(suggested) })}
            </p>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">{tr('order.rrPaidBackBy')}</legend>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((m) => (
                <label key={m.value} className={radio(method === m.value)}>
                  <input type="radio" name="rr-method" className="accent-[var(--brand)]" checked={method === m.value} onChange={() => setMethod(m.value)} />
                  {tr(m.label)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{tr('order.rrProduct')}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className={radio(outcome === 'inspect')}>
              <input type="radio" name="rr-outcome" className="accent-[var(--brand)]" checked={outcome === 'inspect'} onChange={() => setOutcome('inspect')} />
              <span>
                {tr('order.rrInspect')}
                <span className="block text-[11px] font-normal text-[var(--fg-muted)]">{tr('order.rrInspectHint')}</span>
              </span>
            </label>
            <label className={radio(outcome === 'restock')}>
              <input type="radio" name="rr-outcome" className="accent-[var(--brand)]" checked={outcome === 'restock'} onChange={() => setOutcome('restock')} />
              <span>
                {tr('order.rrRestock')}
                <span className="block text-[11px] font-normal text-[var(--fg-muted)]">{tr('order.rrRestockHint')}</span>
              </span>
            </label>
            <label className={cn(radio(outcome === 'write-off'), !canWriteOff && 'cursor-not-allowed opacity-50')}>
              <input
                type="radio"
                name="rr-outcome"
                className="accent-[var(--brand)]"
                disabled={!canWriteOff}
                checked={outcome === 'write-off'}
                onChange={() => setOutcome('write-off')}
              />
              <span>
                {tr('order.rrWriteOff')}
                <span className="block text-[11px] font-normal text-[var(--fg-muted)]">
                  {canWriteOff ? tr('order.rrWriteOffHint') : tr('order.rrNeedsOwner')}
                </span>
              </span>
            </label>
          </div>
        </fieldset>

        <p className="rounded-xl bg-[var(--bg-muted)] px-3 py-2.5 text-xs leading-relaxed text-[var(--fg-muted)]">
          {outcome === 'write-off' ? tr('order.rrProfitNoteLoss') : tr('order.rrProfitNote')}
        </p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tr('order.cancel')}
          </Button>
          <Button type="submit" loading={submit.isPending} disabled={!chosen.length || Boolean(amountError)}>
            {tr('order.rrConfirm')}{parsed > 0 && !amountError ? ` · ${formatCurrency(parsed)}` : ''}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
