import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDateTime } from '@/lib/format'
import { toast } from '@/store/toastStore'
import type { Order } from '@/types'

/** Staff view of an order's deposit: set or remove it while pending, and mark it received. */
export function OrderDepositPanel({ order }: { order: Order }) {
  const qc = useQueryClient()
  const deposit = order.deposit
  const editable = order.orderStatus === 'pending'
  const [amount, setAmount] = useState('')

  useEffect(() => {
    setAmount(deposit?.amount ? String(deposit.amount) : '')
  }, [deposit?.amount])

  const save = useMutation({
    mutationFn: (payload: { amount?: number; received?: boolean }) =>
      adminApi.orders.setDeposit(order._id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-order', order._id] })
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      toast.success('Deposit updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const parsed = amount.trim() === '' ? 0 : Number(amount)
  const invalid = !Number.isFinite(parsed) || parsed < 0 || parsed > order.pricing.total
  const unchanged = parsed === (deposit?.amount ?? 0)

  if (!deposit && !editable) return null

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Deposit</h2>
        {deposit ? (
          deposit.status === 'received' ? (
            <Badge variant="success">Received</Badge>
          ) : (
            <Badge variant="warning">Awaiting deposit</Badge>
          )
        ) : (
          <Badge variant="muted">None</Badge>
        )}
        {deposit ? (
          <span className="text-xs text-[var(--fg-muted)]">
            {deposit.source === 'products' ? 'From product rules' : 'Set by staff'}
          </span>
        ) : null}
      </div>

      {deposit ? (
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--fg-muted)]">Deposit</dt>
            <dd className="tabular-nums font-semibold">{formatCurrency(deposit.amount)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--fg-muted)]">Collect on delivery</dt>
            <dd className="tabular-nums">
              {formatCurrency(Math.max(0, order.pricing.total - deposit.amount))}
            </dd>
          </div>
          {deposit.receivedAt ? (
            <p className="text-xs text-[var(--fg-muted)]">Received {formatDateTime(deposit.receivedAt)}</p>
          ) : null}
        </dl>
      ) : null}

      {deposit?.status === 'pending' && editable ? (
        <p className="mt-3 text-xs text-[var(--fg-muted)]">
          The order can't be confirmed until the deposit is marked as received.
        </p>
      ) : null}

      {editable ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Deposit amount (DH)"
            type="number"
            inputMode="decimal"
            min={0}
            max={order.pricing.total}
            step="any"
            placeholder="0 = no deposit"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={invalid ? `Between 0 and ${formatCurrency(order.pricing.total)}` : undefined}
          />
          <Button
            variant="outline"
            className="shrink-0"
            disabled={invalid || unchanged}
            loading={save.isPending && save.variables?.amount !== undefined}
            onClick={() => save.mutate({ amount: parsed })}
          >
            {parsed === 0 && deposit ? 'Remove deposit' : 'Save amount'}
          </Button>
          {deposit ? (
            <Button
              className="shrink-0"
              variant={deposit.status === 'received' ? 'ghost' : 'primary'}
              loading={save.isPending && save.variables?.received !== undefined}
              onClick={() => save.mutate({ received: deposit.status !== 'received' })}
            >
              {deposit.status === 'received' ? 'Mark as not received' : 'Mark as received'}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
