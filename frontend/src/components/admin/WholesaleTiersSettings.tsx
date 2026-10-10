import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/toastStore'
import { SiteIcon } from '@/components/ui/SiteIcon'
import type { StoreSettings, WholesaleTier } from '@/types'
import { SaveBar, SettingsCard } from './settings/SettingsUi'
import { useReportDirty } from './settings/dirty'

const MAX_TIERS = 10

interface TierRow {
  /** Local key for React lists. */
  key: string
  /** Server id; empty for rows not saved yet. */
  id: string
  name: string
  discountPercent: string
}

const slugId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)

let keySeq = 0
const nextKey = () => `tier-${++keySeq}`

const toRows = (tiers?: WholesaleTier[]): TierRow[] =>
  (tiers ?? []).map((t) => ({
    key: nextKey(),
    id: t.id,
    name: t.name,
    discountPercent: String(t.discountPercent),
  }))

const rowError = (row: TierRow): string | undefined => {
  if (!row.name.trim()) return 'Name is required'
  const pct = Number(row.discountPercent)
  if (row.discountPercent.trim() === '' || !Number.isFinite(pct) || pct < 0 || pct > 90) {
    return 'Discount must be between 0 and 90%'
  }
  return undefined
}

/** Admin: wholesale / business price tiers (a % off the catalog price). */
export function WholesaleTiersSettings({ settings }: { settings?: StoreSettings }) {
  const qc = useQueryClient()
  const [rows, setRows] = useState<TierRow[]>([])
  const [confirmRemove, setConfirmRemove] = useState<TierRow | null>(null)

  const reset = useCallback(() => {
    if (settings) setRows(toRows(settings.wholesaleTiers))
  }, [settings])
  useEffect(reset, [reset])

  const savedIds = new Set((settings?.wholesaleTiers ?? []).map((t) => t.id))

  const save = useMutation({
    mutationFn: () =>
      adminApi.settings.update({
        wholesaleTiers: rows.map((r) => ({
          id: r.id || slugId(r.name),
          name: r.name.trim(),
          discountPercent: Number(r.discountPercent),
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast.success('Wholesale tiers saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const update = (key: string, patch: Partial<TierRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key))

  const errors = rows.map(rowError)
  const ids = rows.map((r) => r.id || slugId(r.name))
  const duplicate = ids.some((id, i) => id && ids.indexOf(id) !== i)
  const invalid = errors.some(Boolean) || duplicate

  const dirty =
    Boolean(settings) &&
    JSON.stringify(rows.map((r) => [r.id, r.name.trim(), Number(r.discountPercent)])) !==
      JSON.stringify((settings?.wholesaleTiers ?? []).map((t) => [t.id, t.name, t.discountPercent]))
  useReportDirty('wholesale', dirty)

  return (
    <SettingsCard
      title="Wholesale price tiers"
      description="% off the catalog price for approved business customers. Assign tiers in Customers; past orders keep their prices."
      footer={
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          invalid={invalid}
          error={duplicate ? 'Two tiers have the same name' : errors.some(Boolean) ? 'Fix the highlighted tiers' : undefined}
          onReset={reset}
          onSave={() => save.mutate()}
        />
      }
    >
      {rows.length === 0 ? <p className="text-sm text-[var(--fg-muted)]">No tiers yet, e.g. “Reseller” at 10%.</p> : null}

      {rows.map((row, i) => (
        <div key={row.key} className="grid max-w-xl grid-cols-[minmax(0,1fr)_7rem_auto] items-start gap-2">
          <Input
            label={i === 0 ? 'Tier name' : undefined}
            aria-label="Tier name"
            value={row.name}
            maxLength={40}
            placeholder="e.g. Reseller"
            onChange={(e) => update(row.key, { name: e.target.value })}
            error={!row.name.trim() ? errors[i] : undefined}
          />
          <Input
            label={i === 0 ? 'Discount %' : undefined}
            aria-label="Discount percent"
            type="number"
            inputMode="decimal"
            min={0}
            max={90}
            step={0.5}
            value={row.discountPercent}
            onChange={(e) => update(row.key, { discountPercent: e.target.value })}
            error={row.name.trim() ? errors[i] : undefined}
          />
          <button
            type="button"
            onClick={() => (savedIds.has(row.id) ? setConfirmRemove(row) : removeRow(row.key))}
            className={`${i === 0 ? 'mt-7' : 'mt-1'} inline-flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]`}
            aria-label={`Remove ${row.name || 'tier'}`}
          >
            <SiteIcon name="trash" size={14} />
          </button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={rows.length >= MAX_TIERS}
        onClick={() => setRows((prev) => [...prev, { key: nextKey(), id: '', name: '', discountPercent: '10' }])}
      >
        <SiteIcon name="plus" size={14} /> Add tier
      </Button>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title={`Remove “${confirmRemove?.name || 'tier'}”?`}
        description="Customers on this tier get retail prices after you save, until you assign another tier. Past orders are not changed."
        confirmLabel="Remove"
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) removeRow(confirmRemove.key)
          setConfirmRemove(null)
        }}
      />
    </SettingsCard>
  )
}
