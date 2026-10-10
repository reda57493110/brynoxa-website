import { useState, type FormEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Section } from '@/components/admin/customers/shared'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { InventoryBucket, InventoryStatusDef, ProductInventoryDetail } from '@/types'
import { bucketLabel } from './ProductLabels'

type Tab = 'move' | 'adjust' | 'serials'

/** Manual moves the server accepts (custom = any admin-defined status). */
const ALLOWED: Record<string, string[]> = {
  awaitingInspection: ['available', 'defective', 'underRepair', 'writtenOff', 'custom'],
  defective: ['underRepair', 'writtenOff', 'custom'],
  available: ['defective', 'underRepair', 'awaitingInspection', 'writtenOff', 'custom'],
  custom: ['available', 'defective', 'underRepair', 'writtenOff', 'custom'],
}

const keyOf = (b: string) => (b.startsWith('custom:') ? 'custom' : b)

function count(detail: ProductInventoryDetail, bucket: string) {
  if (bucket.startsWith('custom:')) return detail.custom[bucket.slice(7)] || 0
  return detail.buckets[bucket as keyof ProductInventoryDetail['buckets']] ?? 0
}

function toInt(v: string) {
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? n : 0
}

export function ProductActions({
  detail,
  statuses,
  canApprove,
  onDone,
}: {
  detail: ProductInventoryDetail
  statuses: InventoryStatusDef[]
  canApprove: boolean
  onDone: () => void
}) {
  const serialMode = detail.product.serialTracking
  const tabs: { id: Tab; label: string }[] = [
    { id: 'move', label: 'Change status' },
    ...(canApprove ? [{ id: 'adjust' as const, label: 'Adjust count' }] : []),
    ...(serialMode && detail.untrackedUnits > 0 ? [{ id: 'serials' as const, label: 'Register serials' }] : []),
  ]
  const [tab, setTab] = useState<Tab>('move')
  const active = tabs.some((t) => t.id === tab) ? tab : 'move'

  return (
    <Section title="Actions">
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'h-9 rounded-full border px-3 text-sm',
              active === t.id
                ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                : 'border-[var(--border)]'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {active === 'move' ? (
        <MoveForm detail={detail} statuses={statuses} canApprove={canApprove} onDone={onDone} />
      ) : active === 'adjust' ? (
        <AdjustForm detail={detail} statuses={statuses} onDone={onDone} />
      ) : (
        <SerialsForm detail={detail} onDone={onDone} />
      )}
      {!canApprove ? (
        <p className="mt-3 text-[11px] text-[var(--fg-muted)]">
          Write-offs, count adjustments and releasing custom statuses need approval rights.
        </p>
      ) : null}
    </Section>
  )
}

function MoveForm({
  detail,
  statuses,
  canApprove,
  onDone,
}: {
  detail: ProductInventoryDetail
  statuses: InventoryStatusDef[]
  canApprove: boolean
  onDone: () => void
}) {
  const customBuckets = statuses.map((s) => `custom:${s.id}`)
  const fromOptions = ['available', 'awaitingInspection', 'defective', ...customBuckets].filter(
    (b) => count(detail, b) > 0
  )
  const [from, setFrom] = useState(fromOptions[0] ?? '')
  const [to, setTo] = useState('')
  const [qty, setQty] = useState('1')
  const [serials, setSerials] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [fault, setFault] = useState('')

  const fromValid = fromOptions.includes(from) ? from : (fromOptions[0] ?? '')
  const toOptions: string[] = []
  for (const k of fromValid ? (ALLOWED[keyOf(fromValid)] ?? []) : []) {
    if (k === 'custom') toOptions.push(...customBuckets.filter((c) => c !== fromValid))
    else if (k === 'writtenOff' && !canApprove) continue
    else if (k === 'available' && keyOf(fromValid) === 'custom' && !canApprove) continue
    else toOptions.push(k)
  }
  const toValid = toOptions.includes(to) ? to : (toOptions[0] ?? '')

  const max = fromValid ? count(detail, fromValid) : 0
  const serialUnits = detail.product.serialTracking ? detail.units.filter((u) => u.status === fromValid) : []
  const picked = serials.filter((s) => serialUnits.some((u) => u.serial === s))
  const finalQty = picked.length ? picked.length : toInt(qty)

  const move = useMutation({
    mutationFn: () =>
      inventoryApi.move({
        productId: detail.product._id,
        from: fromValid as InventoryBucket,
        to: toValid as InventoryBucket,
        qty: finalQty,
        serials: picked.length ? picked : undefined,
        reason: reason.trim(),
        fault: toValid === 'underRepair' && fault.trim() ? fault.trim() : undefined,
      }),
    onSuccess: () => {
      toast.success(toValid === 'underRepair' ? 'Moved — repair record created' : 'Status changed')
      setQty('1')
      setSerials([])
      setReason('')
      setFault('')
      onDone()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  if (!fromOptions.length) {
    return <p className="text-sm text-[var(--fg-muted)]">No units can change status right now.</p>
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return toast.error('Give a reason')
    if (finalQty < 1 || finalQty > max) return toast.error(`Quantity must be between 1 and ${max}`)
    move.mutate()
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Select
        label="From"
        value={fromValid}
        onChange={(e) => {
          setFrom(e.target.value)
          setSerials([])
        }}
        options={fromOptions.map((b) => ({ value: b, label: `${bucketLabel(b, statuses)} (${count(detail, b)})` }))}
      />
      <Select
        label="To"
        value={toValid}
        onChange={(e) => setTo(e.target.value)}
        options={toOptions.map((b) => ({ value: b, label: bucketLabel(b, statuses) }))}
      />
      {serialUnits.length ? (
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className="mb-1.5 text-sm font-medium">
            Serials <span className="font-normal text-[var(--fg-muted)]">({picked.length} selected)</span>
          </legend>
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {serialUnits.map((u) => {
              const on = picked.includes(u.serial)
              return (
                <button
                  key={u._id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSerials((s) => (on ? s.filter((x) => x !== u.serial) : [...s, u.serial]))}
                  className={cn(
                    'h-8 rounded-lg border px-2 font-mono text-xs',
                    on ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-text)]' : 'border-[var(--border)]'
                  )}
                >
                  {u.serial}
                </button>
              )
            })}
          </div>
        </fieldset>
      ) : null}
      <Input
        label={`Quantity (max ${max})`}
        type="number"
        min={1}
        max={max}
        value={picked.length ? String(picked.length) : qty}
        disabled={picked.length > 0}
        onChange={(e) => setQty(e.target.value)}
      />
      {toValid === 'underRepair' ? (
        <Input label="Fault" placeholder="What is wrong?" value={fault} onChange={(e) => setFault(e.target.value)} />
      ) : null}
      <Input
        label="Reason"
        required
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex items-end sm:col-span-2">
        <Button type="submit" loading={move.isPending} variant={toValid === 'writtenOff' ? 'danger' : 'primary'}>
          {toValid === 'writtenOff' ? 'Write off' : 'Move units'}
        </Button>
      </div>
    </form>
  )
}

function AdjustForm({
  detail,
  statuses,
  onDone,
}: {
  detail: ProductInventoryDetail
  statuses: InventoryStatusDef[]
  onDone: () => void
}) {
  const buckets = [
    'available',
    'awaitingInspection',
    'returned',
    'defective',
    'underRepair',
    ...statuses.map((s) => `custom:${s.id}`),
  ]
  const [bucket, setBucket] = useState('available')
  const [delta, setDelta] = useState('')
  const [reason, setReason] = useState('')
  const [unitCost, setUnitCost] = useState('')
  const d = toInt(delta)

  const adjust = useMutation({
    mutationFn: () =>
      inventoryApi.adjust({
        productId: detail.product._id,
        bucket: bucket as InventoryBucket,
        delta: d,
        reason: reason.trim(),
        unitCost: d > 0 && unitCost !== '' ? Number(unitCost) : undefined,
      }),
    onSuccess: () => {
      toast.success('Count adjusted')
      setDelta('')
      setReason('')
      setUnitCost('')
      onDone()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!d) return toast.error('Enter + or − units')
    if (d < 0 && -d > count(detail, bucket)) return toast.error(`Only ${count(detail, bucket)} units in this status`)
    if (!reason.trim()) return toast.error('Give a reason')
    adjust.mutate()
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Select
        label="Status"
        value={bucket}
        onChange={(e) => setBucket(e.target.value)}
        options={buckets.map((b) => ({ value: b, label: `${bucketLabel(b, statuses)} (${count(detail, b)})` }))}
      />
      <Input
        label="Change (+/−)"
        type="number"
        step={1}
        placeholder="e.g. -2 or 3"
        value={delta}
        onChange={(e) => setDelta(e.target.value)}
      />
      {d > 0 ? (
        <Input
          label="Unit cost (optional)"
          type="number"
          min={0}
          step="0.01"
          value={unitCost}
          onChange={(e) => setUnitCost(e.target.value)}
        />
      ) : null}
      <Input label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Stock-take result" />
      <div className="flex items-end sm:col-span-2">
        <Button type="submit" loading={adjust.isPending}>
          Save adjustment
        </Button>
      </div>
    </form>
  )
}

function SerialsForm({ detail, onDone }: { detail: ProductInventoryDetail; onDone: () => void }) {
  const buckets = (['available', 'reserved', 'awaitingInspection', 'returned', 'defective', 'underRepair'] as const).filter(
    (b) => detail.buckets[b] > 0
  )
  const [bucket, setBucket] = useState<string>(buckets[0] ?? 'available')
  const [text, setText] = useState('')
  const serials = [...new Set(text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean))]

  const register = useMutation({
    mutationFn: () =>
      inventoryApi.registerSerials({ productId: detail.product._id, bucket: bucket as InventoryBucket, serials }),
    onSuccess: (res) => {
      toast.success(`${res.data.data.registered} serial${res.data.data.registered === 1 ? '' : 's'} registered`)
      setText('')
      onDone()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!serials.length) return toast.error('Enter at least one serial')
        register.mutate()
      }}
      className="grid min-w-0 gap-3"
    >
      <p className="text-xs text-[var(--fg-muted)]">{detail.untrackedUnits} units have no serial yet.</p>
      <Select
        label="Status"
        value={bucket}
        onChange={(e) => setBucket(e.target.value)}
        options={buckets.map((b) => ({ value: b, label: `${bucketLabel(b)} (${detail.buckets[b]})` }))}
      />
      <Textarea
        label={`Serial numbers (${serials.length})`}
        placeholder="One per line"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="font-mono text-sm"
      />
      <div>
        <Button type="submit" loading={register.isPending}>
          Register
        </Button>
      </div>
    </form>
  )
}
