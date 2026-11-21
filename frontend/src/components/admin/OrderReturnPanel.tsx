import { useState } from 'react'
import { StaffLink } from '@/components/admin/StaffLink'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { invalidateInventory, todayInput } from '@/components/admin/inventory/MovementLabels'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'
import { useAdminT } from '@/store/adminLangStore'
import { RETURNABLE_STATUSES, wasDelivered } from '@/lib/orderStatus'
import type { CustomerReturn, Order, ReturnPayload } from '@/types'

interface RowState {
  qty: string
  serials: string[]
  reason: string
  conditionNote: string
}

const emptyRow = (): RowState => ({ qty: '0', serials: [], reason: '', conditionNote: '' })

/**
 * Register units that physically came back — a customer return or a parcel the courier brought
 * back. The order becomes Returned / Partially returned. Money goes through Refunds.
 */
export function OrderReturnPanel({ order }: { order: Order }) {
  const tr = useAdminT()
  const qc = useQueryClient()
  const [returnedAt, setReturnedAt] = useState(todayInput())
  const [rows, setRows] = useState<RowState[]>(() => order.items.map(emptyRow))
  const [touched, setTouched] = useState(false)
  const [created, setCreated] = useState<CustomerReturn | null>(null)

  const productId = (i: number) => {
    const p = order.items[i].product
    return typeof p === 'string' ? p : p._id
  }

  const leftOf = (i: number) => Math.max(0, order.items[i].qty - (order.items[i].returnedQty || 0))
  const delivered = wasDelivered(order)

  const analysed = rows.map((r, i) => {
    const left = leftOf(i)
    const n = Number(r.qty)
    const qtyError = !Number.isInteger(n) || n < 0 || n > left ? tr('order.qtyRange', { max: left }) : undefined
    const reasonError = n > 0 && r.reason.trim().length < 3 ? tr('order.reasonRequired') : undefined
    const serialError = r.serials.length && r.serials.length !== n ? (n === 1 ? tr('order.pickSerialOne') : tr('order.pickSerials', { count: n })) : undefined
    return { n: qtyError ? 0 : n, qtyError, reasonError, serialError }
  })
  const selected = analysed.filter((a) => a.n > 0).length
  const hasError = analysed.some((a) => a.qtyError || a.reasonError || a.serialError)

  const update = (i: number, patch: Partial<RowState>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)))

  const submit = useMutation({
    mutationFn: async () => {
      const payload: ReturnPayload = {
        returnedAt: returnedAt || undefined,
        lines: rows
          .map((r, i) => ({ r, i, n: analysed[i].n }))
          .filter((x) => x.n > 0)
          .map(({ r, i, n }) => ({
            productId: productId(i),
            qty: n,
            reason: r.reason.trim(),
            ...(r.serials.length ? { serials: r.serials } : {}),
            ...(r.conditionNote.trim() ? { conditionNote: r.conditionNote.trim() } : {}),
          })),
      }
      return (await inventoryApi.createReturn(order._id, payload)).data.data
    },
    onSuccess: (ret) => {
      qc.invalidateQueries({ queryKey: ['admin-order', order._id] })
      qc.invalidateQueries({ queryKey: ['admin-orders'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      invalidateInventory(qc)
      setCreated(ret)
      setRows(order.items.map(emptyRow))
      setTouched(false)
      toast.success(tr('order.returnRegisteredToast'))
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (!RETURNABLE_STATUSES.includes(order.orderStatus)) return null
  const remaining = order.items.reduce((a, _, i) => a + leftOf(i), 0)
  if (!remaining) return null

  const fillAll = () => {
    setRows(
      order.items.map((_, i) => ({
        ...emptyRow(),
        qty: String(leftOf(i)),
        reason: delivered ? '' : 'Delivery failed: parcel returned by the courier',
      }))
    )
  }

  return (
    <section id="order-returns" className="min-w-0 scroll-mt-20 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold">{tr('order.returnedItems')}</h2>
          <p className="mt-1 text-xs text-[var(--fg-muted)]">
            {delivered ? tr('order.returnHint') : tr('order.returnHintFailed')}
          </p>
        </div>
        <Button type="button" size="sm" variant="secondary" onClick={fillAll}>
          {tr('order.everythingBack')}
        </Button>
      </div>

      {created ? (
        <p className="mt-3 rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm">
          {tr('order.returnRegistered')}{' '}
          <StaffLink
            to={`/admin/inventory/returns/${created._id}`}
            className="font-medium text-[var(--brand-text)] hover:underline"
            fallback={tr('order.assessFallback')}
          >
            {tr('order.assessIt')}
          </StaffLink>{' '}
          {tr('order.untilThen')}
        </p>
      ) : null}

      <form
        className="mt-4 space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (!selected) {
            toast.error(tr('order.enterQty'))
            return
          }
          if (!hasError) submit.mutate()
        }}
      >
        <div className="sm:w-56">
          <Input label={tr('order.dateReturned')} type="date" max={todayInput()} value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} />
        </div>

        <ul className="space-y-3">
          {order.items.map((item, i) => {
            const r = rows[i]
            const a = analysed[i]
            const active = a.n > 0
            return (
              <li key={i} className="min-w-0 space-y-2 rounded-lg border border-[var(--border)] p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-[var(--fg-muted)]">
                      {item.sku} · {tr('order.orderedCount', { count: item.qty })}
                      {item.returnedQty ? ` · ${tr('order.alreadyReturned', { count: item.returnedQty })}` : ''}
                    </p>
                  </div>
                  <div className="w-24 shrink-0">
                    <Input
                      aria-label={tr('order.qtyReturnedOf', { name: item.name })}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={leftOf(i)}
                      disabled={leftOf(i) === 0}
                      value={r.qty}
                      onChange={(e) => update(i, { qty: e.target.value })}
                      error={a.qtyError}
                    />
                  </div>
                </div>
                {active ? (
                  <>
                    {item.serials?.length ? (
                      <fieldset className="space-y-1">
                        <legend className="text-xs font-medium">{tr('order.serials')}</legend>
                        <div className="flex flex-wrap gap-2">
                          {item.serials.map((s) => (
                            <label key={s} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1 font-mono text-xs">
                              <input
                                type="checkbox"
                                checked={r.serials.includes(s)}
                                onChange={(e) =>
                                  update(i, { serials: e.target.checked ? [...r.serials, s] : r.serials.filter((x) => x !== s) })
                                }
                              />
                              {s}
                            </label>
                          ))}
                        </div>
                        {a.serialError ? <p className="text-xs text-[var(--danger)]">{a.serialError}</p> : null}
                      </fieldset>
                    ) : null}
                    <Input
                      label={tr('order.reason')}
                      maxLength={300}
                      placeholder={tr('order.returnReasonPh')}
                      value={r.reason}
                      onChange={(e) => update(i, { reason: e.target.value })}
                      error={touched ? a.reasonError : undefined}
                    />
                    <Input
                      label={tr('order.conditionNote')}
                      maxLength={500}
                      placeholder={tr('order.conditionPh')}
                      value={r.conditionNote}
                      onChange={(e) => update(i, { conditionNote: e.target.value })}
                    />
                  </>
                ) : null}
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-[var(--fg-muted)]">{tr('order.returnMax')}</p>
        <Button type="submit" className="w-full sm:w-auto" loading={submit.isPending} disabled={!selected}>
          {tr('order.registerReturn')}
        </Button>
      </form>
    </section>
  )
}
