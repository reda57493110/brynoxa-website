import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/cn'
import { toast } from '@/store/toastStore'
import type { RepairDetail } from '@/types'
import { invalidateInventory, nativeSelect, useCanApprove } from './MovementLabels'

type Final = 'new' | 'refurbished' | 'used' | 'defective' | 'write-off'

const radio = (active: boolean, disabled?: boolean) =>
  cn(
    'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition',
    active ? 'border-[var(--brand)] bg-[var(--brand)]/10' : 'border-[var(--border)]',
    disabled && 'cursor-not-allowed opacity-50'
  )

/** Quality check: closes the repair and moves the unit to its final status. */
export function RepairQcForm({ repair }: { repair: RepairDetail }) {
  const qc = useQueryClient()
  const canApprove = useCanApprove()
  const [result, setResult] = useState<'passed' | 'failed' | ''>('')
  const [final, setFinal] = useState<Final | ''>('')
  const [target, setTarget] = useState('')
  const [note, setNote] = useState('')

  const productCondition = repair.listings.find((l) => l._id === repair.product)?.condition ?? 'new'
  const targetCondition = final === 'refurbished' || final === 'used' ? final : null
  const candidates = targetCondition ? repair.listings.filter((l) => l.condition === targetCondition) : []

  const createListing = useMutation({
    mutationFn: async (condition: 'refurbished' | 'used') =>
      (await inventoryApi.createListing(repair.product, { condition })).data.data,
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['admin-inventory', 'repair', repair._id] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      setTarget(p._id)
      toast.success('Listing created (hidden — set its price and activate it)')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const complete = useMutation({
    mutationFn: async () =>
      (
        await inventoryApi.completeRepair(repair._id, {
          qcResult: result as 'passed' | 'failed',
          finalStatus: final as Final,
          targetProductId: targetCondition ? target : undefined,
          qcNote: note.trim() || undefined,
        })
      ).data.data,
    onSuccess: () => {
      invalidateInventory(qc)
      toast.success(result === 'passed' ? 'Repair passed QC' : 'Repair closed')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const needsApproval = result === 'passed' || final === 'write-off'
  const blocked = needsApproval && !canApprove
  const ready = Boolean(result && final && (!targetCondition || target)) && !blocked

  const passedOptions: { value: Final; label: string; disabled?: boolean; hint?: string }[] = [
    { value: 'new', label: 'Sell as New', disabled: productCondition !== 'new', hint: productCondition !== 'new' ? 'Only for New listings' : undefined },
    { value: 'refurbished', label: 'Refurbished' },
    { value: 'used', label: 'Used' },
  ]
  const failedOptions: { value: Final; label: string; disabled?: boolean; hint?: string }[] = [
    { value: 'defective', label: 'Defective' },
    { value: 'write-off', label: 'Write off', disabled: !canApprove, hint: !canApprove ? 'Needs approval rights' : undefined },
  ]

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (ready) complete.mutate()
      }}
    >
      <h2 className="font-semibold">Quality check</h2>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="QC result">
        {(['passed', 'failed'] as const).map((r) => (
          <label key={r} className={radio(result === r, r === 'passed' && !canApprove)}>
            <input
              type="radio"
              name="qc-result"
              disabled={r === 'passed' && !canApprove}
              checked={result === r}
              onChange={() => {
                setResult(r)
                setFinal('')
                setTarget('')
              }}
            />
            <span className="min-w-0">
              {r === 'passed' ? 'Passed' : 'Failed'}
              {r === 'passed' && !canApprove ? <span className="block text-[11px] text-[var(--fg-muted)]">Needs approval rights</span> : null}
            </span>
          </label>
        ))}
      </div>

      {result ? (
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">{result === 'passed' ? 'Sell as' : 'Move to'}</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {(result === 'passed' ? passedOptions : failedOptions).map((o) => (
              <label key={o.value} className={radio(final === o.value, o.disabled)}>
                <input
                  type="radio"
                  name="qc-final"
                  disabled={o.disabled}
                  checked={final === o.value}
                  onChange={() => {
                    setFinal(o.value)
                    setTarget('')
                  }}
                />
                <span className="min-w-0">
                  {o.label}
                  {o.hint ? <span className="block text-[11px] text-[var(--fg-muted)]">{o.hint}</span> : null}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {targetCondition ? (
        candidates.length ? (
          <label className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-medium">{targetCondition === 'used' ? 'Used' : 'Refurbished'} listing</span>
            <select className={nativeSelect} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Choose…</option>
              {candidates.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name} ({l.sku})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--fg-muted)]">No {targetCondition} listing for this model yet.</span>
            <Button type="button" size="sm" variant="outline" loading={createListing.isPending} onClick={() => createListing.mutate(targetCondition)}>
              Create {targetCondition === 'used' ? 'Used' : 'Refurbished'} listing
            </Button>
          </div>
        )
      ) : null}

      <Textarea label="QC note" rows={2} className="min-h-16" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />

      {blocked ? (
        <p className="text-xs text-[var(--danger)]">
          {result === 'passed' ? 'Approving a repaired unit for sale' : 'Writing off stock'} needs inventory approval rights.
        </p>
      ) : null}
      <Button type="submit" size="sm" loading={complete.isPending} disabled={!ready}>
        Complete QC
      </Button>
    </form>
  )
}
