import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import type { Order } from '@/types'

const round2 = (n: number) => Math.round(n * 100) / 100

/** Amount actually paid on an order — mirrors the server's refund rule. */
function orderPaidAmount(order: Order): number {
  if (order.orderStatus === 'delivered') return order.pricing.total
  return order.deposit?.status === 'received' ? order.deposit.amount : 0
}

/** Staff view of an order's refunds: history, total, and a form to record a new one. */
export function OrderRefundsPanel({ order }: { order: Order }) {
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
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      setAmount('')
      setReason('')
      setItemsReturned(false)
      setTouched(false)
      toast.success('Refund recorded')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const parsed = Number(amount)
  const amountError =
    amount.trim() === '' || !Number.isFinite(parsed) || parsed <= 0
      ? 'Enter an amount above 0'
      : parsed > refundable
        ? `At most ${formatCurrency(refundable)}`
        : undefined
  const reasonError =
    reason.trim().length < 3 ? 'At least 3 characters' : reason.length > 300 ? 'At most 300 characters' : undefined

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Refunds</h2>
        {totalRefunded > 0 ? (
          <Badge variant={refundable <= 0 ? 'danger' : 'warning'}>
            {refundable <= 0 ? 'Fully refunded' : 'Partly refunded'}
          </Badge>
        ) : (
          <Badge variant="muted">None</Badge>
        )}
      </div>

      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--fg-muted)]">Paid so far</dt>
          <dd className="tabular-nums">{formatCurrency(paid)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--fg-muted)]">Refunded</dt>
          <dd className="tabular-nums font-semibold">
            {totalRefunded > 0 ? `−${formatCurrency(totalRefunded)}` : formatCurrency(0)}
          </dd>
        </div>
        {paid > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--fg-muted)]">Can still refund</dt>
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
                  Items returned
                </Badge>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {refundable <= 0 ? (
        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          {paid <= 0
            ? 'Nothing has been paid on this order yet — refunds can be recorded once a deposit is received or the order is delivered.'
            : 'Fully refunded — nothing left to refund on this order.'}
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
          <h3 className="text-sm font-semibold">Record a refund</h3>
          <Input
            label="Amount (DH)"
            type="number"
            inputMode="decimal"
            min={0}
            max={refundable}
            step="any"
            placeholder={`Up to ${refundable}`}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={touched || amount ? amountError : undefined}
          />
          <Textarea
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="e.g. Customer returned the mouse (defective)"
            error={touched ? reasonError : undefined}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemsReturned}
              onChange={(e) => setItemsReturned(e.target.checked)}
            />
            Items were returned
          </label>
          <Button type="submit" className="w-full sm:w-auto" loading={record.isPending}>
            Record refund
          </Button>
          <p className="text-xs text-[var(--fg-muted)]">
            Refunds are subtracted from net sales in customer reports. Stock is not changed
            automatically — adjust inventory if items come back.
          </p>
        </form>
      )}
    </section>
  )
}
