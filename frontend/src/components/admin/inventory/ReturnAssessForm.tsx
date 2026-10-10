import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { toast } from '@/store/toastStore'
import type { AssessReturnPayload, ReturnLine, ReturnOutcome } from '@/types'
import { invalidateInventory, nativeSelect, useCanApprove } from './MovementLabels'

const OUTCOMES: { value: ReturnOutcome; label: string; approval?: boolean }[] = [
  { value: 'restock-new', label: 'Restock as New' },
  { value: 'used', label: 'Sell as Used' },
  { value: 'repair', label: 'Send to repair' },
  { value: 'defective', label: 'Defective' },
  { value: 'write-off', label: 'Write off', approval: true },
]

/** Decide what happens to (part of) one returned line. */
export function ReturnAssessForm({ returnId, line, remaining }: { returnId: string; line: ReturnLine; remaining: number }) {
  const qc = useQueryClient()
  const canApprove = useCanApprove()
  const [qty, setQty] = useState(String(remaining))
  const [outcome, setOutcome] = useState<ReturnOutcome | ''>('')
  const [meetsNew, setMeetsNew] = useState(false)
  const [target, setTarget] = useState('')
  const [serials, setSerials] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  const detail = useQuery({
    queryKey: ['admin-inventory', 'product-listings', line.product],
    queryFn: async () => (await inventoryApi.product(line.product)).data.data,
    enabled: outcome === 'used' || outcome === 'restock-new',
    staleTime: 30_000,
  })
  const productCondition = detail.data?.product.condition ?? 'new'
  const usedListings = (detail.data?.listings ?? []).filter((l) => l.condition === 'used')

  const createListing = useMutation({
    mutationFn: async () => (await inventoryApi.createListing(line.product, { condition: 'used' })).data.data,
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['admin-inventory', 'product-listings', line.product] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      setTarget(p._id)
      toast.success('Used listing created (hidden — set its price and activate it)')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const n = Number(qty)
  const qtyError = !Number.isInteger(n) || n < 1 || n > remaining ? `Between 1 and ${remaining}` : undefined
  const outcomeError = !outcome ? 'Choose an outcome' : undefined
  const newError = outcome === 'restock-new' && productCondition === 'new' && !meetsNew ? 'Confirm the unit meets new condition' : undefined
  const targetError = outcome === 'used' && !target ? 'Choose the Used listing' : undefined
  const serialError = serials.length && serials.length !== n ? `Pick ${n} serial${n === 1 ? '' : 's'} or none` : undefined
  const approvalBlocked = outcome === 'write-off' && !canApprove

  const assess = useMutation({
    mutationFn: async () => {
      const payload: AssessReturnPayload = {
        lineId: line._id,
        qty: n,
        outcome: outcome as ReturnOutcome,
        note: note.trim() || undefined,
        serials: serials.length ? serials : undefined,
      }
      if (outcome === 'used') payload.targetProductId = target
      if (outcome === 'restock-new') payload.meetsNewCriteria = meetsNew
      return (await inventoryApi.assessReturn(returnId, payload)).data.data
    },
    onSuccess: () => {
      invalidateInventory(qc)
      toast.success('Return assessed')
      setOutcome('')
      setNote('')
      setSerials([])
      setMeetsNew(false)
      setTouched(false)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const err = (e?: string) => (touched ? e : undefined)

  return (
    <form
      className="mt-3 space-y-3 border-t border-[var(--border)] pt-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (qtyError || outcomeError || newError || targetError || serialError || approvalBlocked) return
        assess.mutate()
      }}
    >
      <h4 className="text-sm font-semibold">Assess</h4>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
        <Input
          label="Qty"
          type="number"
          inputMode="numeric"
          min={1}
          max={remaining}
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          error={err(qtyError) ?? (qty && qtyError ? qtyError : undefined)}
        />
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium">Outcome</span>
          <select className={nativeSelect} value={outcome} onChange={(e) => setOutcome(e.target.value as ReturnOutcome)} aria-invalid={Boolean(err(outcomeError))}>
            <option value="" disabled>
              Choose…
            </option>
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value} disabled={o.approval && !canApprove}>
                {o.label}
                {o.approval && !canApprove ? ' (needs approval rights)' : ''}
              </option>
            ))}
          </select>
          {err(outcomeError) ? <span className="text-xs text-[var(--danger)]">{outcomeError}</span> : null}
        </label>
      </div>

      {outcome === 'restock-new' ? (
        productCondition === 'new' ? (
          <div>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={meetsNew} onChange={(e) => setMeetsNew(e.target.checked)} />
              Unopened / meets new condition
            </label>
            {err(newError) ? <p className="mt-1 text-xs text-[var(--danger)]">{newError}</p> : null}
          </div>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">Units go back to available on this {productCondition} listing.</p>
        )
      ) : null}

      {outcome === 'used' ? (
        <div className="space-y-2">
          {detail.isPending ? (
            <p className="text-xs text-[var(--fg-muted)]">Loading listings…</p>
          ) : usedListings.length ? (
            <label className="flex min-w-0 flex-col gap-1.5 text-sm">
              <span className="font-medium">Used listing</span>
              <select className={nativeSelect} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Choose…</option>
                {usedListings.map((l) => (
                  <option key={l._id} value={l._id}>
                    {l.name} ({l.sku}){l.isActive ? '' : ' — hidden'}
                  </option>
                ))}
              </select>
              {err(targetError) ? <span className="text-xs text-[var(--danger)]">{targetError}</span> : null}
            </label>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--fg-muted)]">No Used listing for this model yet.</span>
              <Button type="button" size="sm" variant="outline" loading={createListing.isPending} onClick={() => createListing.mutate()}>
                Create Used listing
              </Button>
            </div>
          )}
        </div>
      ) : null}

      {line.serials.length ? (
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Serials (optional)</legend>
          <div className="flex flex-wrap gap-2">
            {line.serials.map((s) => (
              <label key={s} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1 font-mono text-xs">
                <input
                  type="checkbox"
                  checked={serials.includes(s)}
                  onChange={(e) => setSerials((prev) => (e.target.checked ? [...prev, s] : prev.filter((x) => x !== s)))}
                />
                {s}
              </label>
            ))}
          </div>
          {serialError ? <p className="text-xs text-[var(--danger)]">{serialError}</p> : null}
        </fieldset>
      ) : null}

      <Textarea label="Note" rows={2} className="min-h-16" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />

      {approvalBlocked ? <p className="text-xs text-[var(--danger)]">Write-offs need inventory approval rights.</p> : null}
      <Button type="submit" size="sm" loading={assess.isPending} disabled={approvalBlocked}>
        Save assessment
      </Button>
    </form>
  )
}
