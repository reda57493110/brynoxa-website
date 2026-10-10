import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { invalidateInventory, todayInput } from '@/components/admin/inventory/MovementLabels'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'
import type { CustomerReturn, Order, ReturnPayload } from '@/types'

interface RowState {
  qty: string
  serials: string[]
  reason: string
  conditionNote: string
}

const emptyRow = (): RowState => ({ qty: '0', serials: [], reason: '', conditionNote: '' })

/** Register units a customer sent back (stock side). Money goes through Refunds. */
export function OrderReturnPanel({ order }: { order: Order }) {
  const qc = useQueryClient()
  const [returnedAt, setReturnedAt] = useState(todayInput())
  const [rows, setRows] = useState<RowState[]>(() => order.items.map(emptyRow))
  const [touched, setTouched] = useState(false)
  const [created, setCreated] = useState<CustomerReturn | null>(null)

  const productId = (i: number) => {
    const p = order.items[i].product
    return typeof p === 'string' ? p : p._id
  }

  const analysed = rows.map((r, i) => {
    const item = order.items[i]
    const n = Number(r.qty)
    const qtyError = !Number.isInteger(n) || n < 0 || n > item.qty ? `0 to ${item.qty}` : undefined
    const reasonError = n > 0 && r.reason.trim().length < 3 ? 'Reason required (3+ chars)' : undefined
    const serialError = r.serials.length && r.serials.length !== n ? `Pick ${n} serial${n === 1 ? '' : 's'} or none` : undefined
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
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      invalidateInventory(qc)
      setCreated(ret)
      setRows(order.items.map(emptyRow))
      setTouched(false)
      toast.success('Return registered — assess it to restock')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (order.orderStatus !== 'shipped' && order.orderStatus !== 'delivered') return null

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:rounded-2xl sm:p-5">
      <h2 className="font-semibold">Returned items</h2>
      <p className="mt-1 text-xs text-[var(--fg-muted)]">Register returned items here; record any money given back with Refunds.</p>

      {created ? (
        <p className="mt-3 rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm">
          Return registered.{' '}
          <Link to={`/admin/inventory/returns/${created._id}`} className="font-medium text-[var(--brand-text)] hover:underline">
            Assess it
          </Link>{' '}
          — units stay unsellable until then.
        </p>
      ) : null}

      <form
        className="mt-4 space-y-3"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (!selected) {
            toast.error('Enter a quantity for at least one item')
            return
          }
          if (!hasError) submit.mutate()
        }}
      >
        <div className="sm:w-56">
          <Input label="Date returned" type="date" max={todayInput()} value={returnedAt} onChange={(e) => setReturnedAt(e.target.value)} />
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
                      {item.sku} · {item.qty} ordered
                    </p>
                  </div>
                  <div className="w-24 shrink-0">
                    <Input
                      aria-label={`Quantity returned of ${item.name}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={item.qty}
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
                        <legend className="text-xs font-medium">Serials</legend>
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
                      label="Reason"
                      maxLength={300}
                      placeholder="e.g. Not working, changed mind"
                      value={r.reason}
                      onChange={(e) => update(i, { reason: e.target.value })}
                      error={touched ? a.reasonError : undefined}
                    />
                    <Input
                      label="Condition note"
                      maxLength={500}
                      placeholder="Optional — box opened, scratches…"
                      value={r.conditionNote}
                      onChange={(e) => update(i, { conditionNote: e.target.value })}
                    />
                  </>
                ) : null}
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-[var(--fg-muted)]">The server won't accept more than was shipped minus what was already returned.</p>
        <Button type="submit" className="w-full sm:w-auto" loading={submit.isPending} disabled={!selected}>
          Register return
        </Button>
      </form>
    </section>
  )
}
