import { useState } from 'react'
import { amountPaid } from '@/lib/orderStatus'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { useAdminT } from '@/store/adminLangStore'
import type { Order } from '@/types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Amount actually paid on an order — mirrors the server's refund rule. */
const orderPaidAmount = amountPaid

/** Staff view of an order's refunds: history, total, and a form to record a new one. */
export function OrderRefundsPanel({ order }: { order: Order }) {
  const tr = useAdminT()
  const qc = useQueryClient()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [itemsReturned, setItemsReturned] = useState(false)
  const [touched, setTouched] = useState(false)

  const refunds = order.refunds ?? []
  const totalRefunded = round2(refunds.reduce((sum, r) => sum + r.amount, 0))
  const paid = orderPaidAmount(order)
  const refundable = round2(Math.max(0, paid - totalRefunded))

  const record = useMutation({
    mutationFn: () =>
      adminApi.orders.recordRefund(order._id, {
        amount: Number(amount),
        reason: reason.trim(),
        itemsReturned,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', order._id] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      setAmount('')
      setReason('')
      setItemsReturned(false)
      setTouched(false)
      toast.success(tr('order.refundRecorded'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const parsed = Number(amount)
  const amountError =
    amount.trim() === '' || !Number.isFinite(parsed) || parsed <= 0
      ? tr('order.amountAbove0')
      : parsed > refundable
        ? tr('order.atMost', { amount: formatCurrency(refundable) })
        : undefined
  const reasonError =
    reason.trim().length < 3 ? tr('order.min3') : reason.length > 300 ? tr('order.max300') : undefined

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">{tr('order.refunds')}</h2>
        {totalRefunded > 0 ? (
          <Badge variant={refundable <= 0 ? 'danger' : 'warning'}>
            {refundable <= 0 ? tr('order.fullyRefunded') : tr('order.partlyRefunded')}
          </Badge>
        ) : (
          <Badge variant="muted">{tr('order.none')}</Badge>
        )}
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--fg-muted)]">{tr('order.paidSoFar')}</dt>
          <dd className="tabular-nums">{formatCurrency(paid)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--fg-muted)]">{tr('order.refunded')}</dt>
          <dd className="tabular-nums font-semibold">
            {totalRefunded > 0 ? `−${formatCurrency(totalRefunded)}` : formatCurrency(0)}
          </dd>
        </div>
        {paid > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--fg-muted)]">{tr('order.canStillRefund')}</dt>
            <dd className="tabular-nums">{formatCurrency(refundable)}</dd>
          </div>
        ) : null}
      </dl>

      {refunds.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {refunds.map((r, i) => (
            <li
              key={`${r.at}-${i}`}
              className="min-w-0 rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="tabular-nums font-semibold">−{formatCurrency(r.amount)}</span>
                <span className="text-xs text-[var(--fg-muted)]">{formatDateTime(r.at)}</span>
              </div>
              <p className="mt-0.5 break-words text-[var(--fg-muted)]">{r.reason}</p>
              {r.itemsReturned ? (
                <Badge variant="brand" className="mt-1">
                  {tr('order.itemsReturned')}
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {refundable <= 0 ? (
        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          {paid <= 0
            ? tr('order.nothingPaid')
            : tr('order.nothingLeft')}
        </p>
      ) : (
        <form
          className="mt-4 space-y-3 border-t border-[var(--border)] pt-4"
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (!amountError && !reasonError) record.mutate()
          }}
        >
          <h3 className="text-sm font-semibold">{tr('order.recordRefundTitle')}</h3>
          <Input
            label={tr('order.amountDh')}
            type="number"
            inputMode="decimal"
            min={0}
            max={refundable}
            step="any"
            placeholder={tr('order.upTo', { amount: refundable })}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={touched || amount ? amountError : undefined}
          />
          <Textarea
            label={tr('order.reason')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder={tr('order.refundReasonPh')}
            error={touched ? reasonError : undefined}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemsReturned}
              onChange={(e) => setItemsReturned(e.target.checked)}
            />
            {tr('order.itemsWereReturned')}
          </label>
          <Button type="submit" className="w-full sm:w-auto" loading={record.isPending}>
            {tr('order.recordRefund')}
          </Button>
          <p className="text-xs text-[var(--fg-muted)]">
            {tr('order.refundsHint')}
          </p>
        </form>
      )}
    </section>
  )
}
