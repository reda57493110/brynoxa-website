import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { InventoryNav } from '@/components/admin/inventory/InventoryNav'
import { invCard, invalidateInventory, todayInput } from '@/components/admin/inventory/MovementLabels'
import { ReceiveHistory, ReceiveResultText } from '@/components/admin/inventory/ReceiveHistory'
import { ReceiveLineEditor } from '@/components/admin/inventory/ReceiveLineEditor'
import {
  analyseLine,
  lineToPayload,
  newReceiveLine,
  type ReceiveLineState,
} from '@/components/admin/inventory/ReceiveLine'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Textarea } from '@/components/ui/Textarea'
import { formatCurrency, formatDate } from '@/lib/format'
import { toast } from '@/store/toastStore'
import type { ReceiptPayload, SupplierReceipt } from '@/types'

function isUrl(s: string) {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function InventoryReceive() {
  const qc = useQueryClient()
  const [supplier, setSupplier] = useState('')
  const [reference, setReference] = useState('')
  const [receivedAt, setReceivedAt] = useState(todayInput())
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [evidence, setEvidence] = useState('')
  const [lines, setLines] = useState<ReceiveLineState[]>(() => [newReceiveLine()])
  const [touched, setTouched] = useState(false)
  const [done, setDone] = useState<SupplierReceipt | null>(null)

  const summary = useQuery({
    queryKey: ['admin-inventory', 'summary'],
    queryFn: async () => (await inventoryApi.summary()).data.data,
    staleTime: 60_000,
  })
  const requireInspection = summary.data?.requireInspection ?? true
  const locations = summary.data?.locations ?? []

  const analyses = useMemo(() => lines.map((l) => analyseLine(l, requireInspection)), [lines, requireInspection])
  const evidenceUrls = evidence
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const supplierError = supplier.trim().length < 2 ? 'Enter the supplier' : undefined
  const evidenceError = evidenceUrls.length > 10 ? 'At most 10 links' : evidenceUrls.find((u) => !isUrl(u)) ? 'Each line must be a full http(s) link' : undefined
  const lineErrors = analyses.some((a) => Object.keys(a.errors).length > 0)
  const grandTotal = analyses.reduce((s, a) => s + (a.total ?? 0), 0)
  const grandQty = analyses.reduce((s, a) => s + a.qty, 0)

  const reset = () => {
    setSupplier('')
    setReference('')
    setReceivedAt(todayInput())
    setNotes('')
    setEvidence('')
    setLines([newReceiveLine()])
    setTouched(false)
    setDone(null)
  }

  const submit = useMutation({
    mutationFn: async () => {
      const payload: ReceiptPayload = {
        supplier: supplier.trim(),
        reference: reference.trim() || undefined,
        receivedAt: receivedAt || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        evidenceUrls: evidenceUrls.length ? evidenceUrls : undefined,
        lines: lines.map((l, i) => lineToPayload(l, analyses[i], requireInspection)),
      }
      return (await inventoryApi.receive(payload)).data.data
    },
    onSuccess: (receipt) => {
      invalidateInventory(qc)
      toast.success('Delivery recorded')
      setDone(receipt)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const updateLine = (key: string, patch: Partial<ReceiveLineState>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InventoryNav />
      <AdminHeader title="Receive delivery" description="Log supplier stock and its inspection results." />

      {done ? (
        <section className={`${invCard} space-y-3 p-3 sm:p-5`}>
          <div className="flex items-center gap-2">
            <SiteIcon name="package-check" size={18} className="text-[var(--success)]" />
            <h2 className="font-semibold">Delivery recorded</h2>
          </div>
          <p className="text-sm text-[var(--fg-muted)]">
            {done.supplier}
            {done.reference ? ` · ${done.reference}` : ''} · {formatDate(done.receivedAt)}
            {done.location ? ` · ${done.location}` : ''}
          </p>
          <ul className="space-y-2">
            {done.lines.map((l, i) => (
              <li key={l._id ?? i} className="flex min-w-0 flex-col gap-1 rounded-lg border border-[var(--border)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="break-words font-medium">
                    {l.qty} × {l.name}
                  </p>
                  <ReceiveResultText line={l} />
                </div>
                <Link
                  to={`/admin/inventory/products/${l.product}`}
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-[var(--border)] px-3 text-sm hover:border-[var(--brand)]"
                >
                  View stock
                </Link>
              </li>
            ))}
          </ul>
          <Button onClick={reset}>
            <SiteIcon name="plus" size={14} /> Record another
          </Button>
        </section>
      ) : (
        <form
          className="min-w-0 space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setTouched(true)
            if (supplierError || evidenceError || lineErrors) {
              toast.error('Check the highlighted fields')
              return
            }
            submit.mutate()
          }}
        >
          <section className={`${invCard} space-y-3 p-3 sm:p-5`}>
            <h2 className="font-semibold">Delivery</h2>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <Input
                label="Supplier"
                maxLength={120}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                error={touched ? supplierError : undefined}
              />
              <Input label="PO / invoice ref" maxLength={120} placeholder="Optional" value={reference} onChange={(e) => setReference(e.target.value)} />
              <Input label="Date received" type="date" max={todayInput()} value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
              <div className="min-w-0">
                <Input
                  label="Storage location"
                  list="inventory-locations"
                  maxLength={80}
                  placeholder={locations.length ? 'Pick or type' : 'Optional'}
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
                <datalist id="inventory-locations">
                  {locations.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
              </div>
            </div>
            <Textarea label="Notes" rows={2} className="min-h-16" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Textarea
              label="Evidence links (optional, one per line)"
              rows={2}
              className="min-h-16 text-xs"
              placeholder="https://…"
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              error={touched || evidence ? evidenceError : undefined}
            />
          </section>

          <section className={`${invCard} space-y-3 p-3 sm:p-5`}>
            <h2 className="font-semibold">Products</h2>
            {lines.map((line, i) => (
              <ReceiveLineEditor
                key={line.key}
                index={i}
                line={line}
                analysis={analyses[i]}
                requireInspection={requireInspection}
                showErrors={touched}
                canRemove={lines.length > 1}
                onChange={(patch) => updateLine(line.key, patch)}
                onRemove={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
              />
            ))}
            <Button type="button" variant="outline" size="sm" disabled={lines.length >= 100} onClick={() => setLines((prev) => [...prev, newReceiveLine()])}>
              <SiteIcon name="plus" size={14} /> Add product
            </Button>

            <div className="space-y-1 rounded-lg border border-dashed border-[var(--border)] p-3 text-xs text-[var(--fg-muted)]">
              <p>
                {requireInspection
                  ? 'Units without a result wait in "Awaiting inspection" and cannot be sold until inspected.'
                  : 'Inspection is optional: with no results entered, all units become sellable.'}
              </p>
              <p>Units marked "Needs repair" get a repair record automatically.</p>
            </div>

            <div className="flex min-w-0 flex-col gap-3 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm">
                {grandQty} unit{grandQty === 1 ? '' : 's'}
                {grandTotal > 0 ? ` · ${formatCurrency(Math.round(grandTotal * 100) / 100)}` : ''}
              </p>
              <Button type="submit" loading={submit.isPending} className="w-full sm:w-auto">
                Record delivery
              </Button>
            </div>
          </section>
        </form>
      )}

      <ReceiveHistory />
    </div>
  )
}
