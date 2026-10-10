import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { toast } from '@/store/toastStore'

export interface AddStockTarget {
  _id: string
  name: string
  sellable: number
  serialTracking?: boolean
}

/**
 * Quick "units arrived" for an existing product: 20 in stock + 20 added = 40.
 * Recorded as a delivery in the stock log (no duplicate product, no silent overwrite).
 * Serial-tracked products need one serial number per unit.
 */
export function AddStockDialog({ product, onClose }: { product: AddStockTarget | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [qty, setQty] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const [supplier, setSupplier] = useState('')
  const [serials, setSerials] = useState('')

  const n = Math.floor(Number(qty))
  const serialList = serials.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
  const needsSerials = Boolean(product?.serialTracking)
  const valid = n > 0 && (!needsSerials || serialList.length === n) && (unitCost === '' || Number(unitCost) >= 0)

  const close = () => {
    setQty('')
    setUnitCost('')
    setSupplier('')
    setSerials('')
    onClose()
  }

  const add = useMutation({
    mutationFn: () =>
      inventoryApi.receive({
        supplier: supplier.trim() || 'Stock added manually',
        lines: [
          {
            productId: product!._id,
            qty: n,
            unitCost: unitCost === '' ? undefined : Number(unitCost),
            serials: needsSerials ? serialList : undefined,
            // Straight to sellable stock: the admin confirms these units are ready to sell
            result: { available: n },
          },
        ],
      }),
    onSuccess: () => {
      toast.success(`${n} unit${n === 1 ? '' : 's'} added — now ${(product?.sellable ?? 0) + n} in stock`)
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-product'] })
      close()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (valid && !add.isPending) add.mutate()
  }

  return (
    <Modal open={Boolean(product)} onClose={close} title={product ? `Add stock — ${product.name}` : 'Add stock'}>
      {product ? (
        <form className="space-y-4" onSubmit={submit}>
          <p className="text-sm text-[var(--fg-muted)]">
            In stock now: <span className="font-semibold text-[var(--fg)]">{product.sellable}</span>
            {n > 0 ? (
              <>
                {' '}→ after adding: <span className="font-semibold text-[var(--fg)]">{product.sellable + n}</span>
              </>
            ) : null}
          </p>
          <Input
            label="Units to add"
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            autoFocus
            required
          />
          <Input
            label="Purchase cost per unit (DH, optional)"
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          <Input
            label="Supplier (optional)"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Stock added manually"
            maxLength={120}
          />
          {needsSerials ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">
                Serial numbers ({serialList.length}/{n > 0 ? n : 0})
              </span>
              <textarea
                value={serials}
                onChange={(e) => setSerials(e.target.value)}
                rows={4}
                placeholder="One per line"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3.5 py-2.5 text-[var(--fg)] outline-none ring-brand"
              />
            </label>
          ) : null}
          <p className="text-xs text-[var(--fg-muted)]">
            Units go straight to sellable stock and appear in the stock log. To inspect a delivery first, use Inventory →
            Receive delivery.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid} loading={add.isPending}>
              {n > 0 ? `Add ${n} to stock` : 'Add to stock'}
            </Button>
          </div>
        </form>
      ) : null}
    </Modal>
  )
}
