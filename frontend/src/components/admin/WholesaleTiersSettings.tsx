import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/toastStore'
import type { StoreSettings, WholesaleTier } from '@/types'

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

  useEffect(() => {
    if (settings) setRows(toRows(settings.wholesaleTiers))
  }, [settings])

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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Wholesale pricing</h2>
        <div className="mt-1 space-y-1 text-sm text-[var(--fg-muted)]">
          <p>
            Approved wholesale / business customers get their tier's % off the catalog price
            automatically at checkout. You assign a tier when you approve a customer in Admin →
            Customers.
          </p>
          <p>
            Changing a tier's % only affects future orders — past orders keep the price they were
            charged.
          </p>
        </div>
      </div>

      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-6">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--fg-muted)]">
            No tiers yet. Add one (e.g. “Reseller” at 10%) to offer business prices.
          </p>
        ) : null}

        {rows.map((row, i) => (
          <div
            key={row.key}
            className="grid gap-3 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_9rem_auto] sm:items-start"
          >
            <Input
              label="Tier name"
              value={row.name}
              maxLength={40}
              placeholder="e.g. Reseller"
              onChange={(e) => update(row.key, { name: e.target.value })}
              error={!row.name.trim() ? errors[i] : undefined}
            />
            <Input
              label="Discount (%)"
              type="number"
              inputMode="decimal"
              min={0}
              max={90}
              step={0.5}
              value={row.discountPercent}
              onChange={(e) => update(row.key, { discountPercent: e.target.value })}
              error={row.name.trim() ? errors[i] : undefined}
            />
            <div className="flex items-center justify-between gap-2 sm:pt-7">
              <span className="truncate text-xs text-[var(--fg-muted)] sm:hidden">
                {row.id ? `ID: ${row.id}` : 'New tier'}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => (savedIds.has(row.id) ? setConfirmRemove(row) : removeRow(row.key))}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}

        {duplicate ? (
          <p className="text-xs text-[var(--danger)]">Two tiers have the same name — make each name unique.</p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            disabled={rows.length >= MAX_TIERS}
            title={rows.length >= MAX_TIERS ? `Up to ${MAX_TIERS} tiers` : undefined}
            onClick={() =>
              setRows((prev) => [...prev, { key: nextKey(), id: '', name: '', discountPercent: '10' }])
            }
          >
            Add tier
          </Button>
          <Button
            type="button"
            onClick={() => save.mutate()}
            loading={save.isPending}
            disabled={invalid}
          >
            Save wholesale tiers
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title={`Remove “${confirmRemove?.name || 'tier'}”?`}
        description="Customers may already be assigned to this tier. Once you save, they get retail prices until you assign them another tier in Admin → Customers. Past orders are not changed."
        confirmLabel="Remove"
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) removeRow(confirmRemove.key)
          setConfirmRemove(null)
        }}
      />
    </section>
  )
}
