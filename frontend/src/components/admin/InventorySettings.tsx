import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'
import type { InventoryStatusDef, StoreSettings } from '@/types'
import { SaveBar, SettingsCard, Switch } from './settings/SettingsUi'
import { useReportDirty } from './settings/dirty'

const MAX_LOCATIONS = 50
const MAX_LOCATION_LENGTH = 80
const MAX_STATUSES = 20
const MAX_STATUS_LENGTH = 40

interface StatusRow {
  /** Local key for React lists. */
  key: string
  /** Server id; empty for rows not saved yet (the server assigns one). */
  id: string
  name: string
}

let keySeq = 0
const nextKey = () => `inv-status-${++keySeq}`

const toRows = (statuses?: InventoryStatusDef[]): StatusRow[] =>
  (statuses ?? []).map((s) => ({ key: nextKey(), id: s.id, name: s.name }))

/** Admin: inspection rule, storage locations and custom holding statuses for inventory. */
export function InventorySettings({ settings }: { settings?: StoreSettings }) {
  const qc = useQueryClient()
  const [requireInspection, setRequireInspection] = useState(true)
  const [locations, setLocations] = useState<string[]>([])
  const [locationDraft, setLocationDraft] = useState('')
  const [statuses, setStatuses] = useState<StatusRow[]>([])
  const [confirmRemove, setConfirmRemove] = useState<StatusRow | null>(null)

  const reset = useCallback(() => {
    if (!settings) return
    setRequireInspection(settings.requireInspection ?? true)
    setLocations(settings.inventoryLocations ?? [])
    setStatuses(toRows(settings.inventoryStatuses))
    setLocationDraft('')
  }, [settings])
  useEffect(reset, [reset])

  const savedIds = new Set((settings?.inventoryStatuses ?? []).map((s) => s.id))

  const save = useMutation({
    mutationFn: () =>
      adminApi.settings.update({
        requireInspection,
        inventoryLocations: locations,
        // New rows send no id: the server creates one. Existing ids are kept so units stay linked.
        inventoryStatuses: statuses.map((s) =>
          s.id ? { id: s.id, name: s.name.trim() } : { name: s.name.trim() }
        ) as InventoryStatusDef[],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      toast.success('Inventory settings saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const draft = locationDraft.trim()
  const draftDuplicate = locations.some((l) => l.toLowerCase() === draft.toLowerCase())
  const canAddLocation = Boolean(draft) && !draftDuplicate && locations.length < MAX_LOCATIONS

  const addLocation = () => {
    if (!canAddLocation) return
    setLocations((prev) => [...prev, draft.slice(0, MAX_LOCATION_LENGTH)])
    setLocationDraft('')
  }

  const updateStatus = (key: string, name: string) =>
    setStatuses((prev) => prev.map((s) => (s.key === key ? { ...s, name } : s)))
  const removeStatus = (key: string) => setStatuses((prev) => prev.filter((s) => s.key !== key))

  const names = statuses.map((s) => s.name.trim().toLowerCase())
  const emptyStatus = names.some((n) => !n)
  const duplicateStatus = names.some((n, i) => n && names.indexOf(n) !== i)
  const invalid = emptyStatus || duplicateStatus

  const dirty =
    Boolean(settings) &&
    (requireInspection !== (settings?.requireInspection ?? true) ||
      JSON.stringify(locations) !== JSON.stringify(settings?.inventoryLocations ?? []) ||
      JSON.stringify(statuses.map((s) => [s.id, s.name.trim()])) !==
        JSON.stringify((settings?.inventoryStatuses ?? []).map((s) => [s.id, s.name])))
  useReportDirty('inventory', dirty)

  return (
    <SettingsCard
      title="Stock handling"
      description="Receiving rules, storage locations and holding statuses."
      footer={
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          invalid={invalid}
          error={duplicateStatus ? 'Two statuses have the same name' : emptyStatus ? 'Every status needs a name' : undefined}
          onReset={reset}
          onSave={() => save.mutate()}
        />
      }
    >
      <Switch
        checked={requireInspection}
        onChange={setRequireInspection}
        label="Inspect new deliveries before selling"
        hint="Received units wait in “Awaiting inspection”. When off, they go straight to stock."
      />

      <div className="space-y-2 border-t border-[var(--border)] pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">Storage locations</p>
          <span className="text-xs tabular-nums text-[var(--fg-muted)]">
            {locations.length}/{MAX_LOCATIONS}
          </span>
        </div>
        {locations.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {locations.map((loc) => (
              <li
                key={loc}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-muted)]/50 py-0.5 ps-3 pe-1 text-sm"
              >
                <span className="min-w-0 truncate">{loc}</span>
                <button
                  type="button"
                  onClick={() => setLocations((prev) => prev.filter((l) => l !== loc))}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:text-[var(--danger)]"
                  aria-label={`Remove location ${loc}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">No locations yet.</p>
        )}
        <div className="flex max-w-md items-end gap-2">
          <Input
            aria-label="New location"
            value={locationDraft}
            maxLength={MAX_LOCATION_LENGTH}
            placeholder="e.g. Warehouse — Rack 2"
            onChange={(e) => setLocationDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addLocation()
              }
            }}
            error={draft && draftDuplicate ? 'Already in the list' : undefined}
          />
          <Button type="button" variant="outline" className="shrink-0" disabled={!canAddLocation} onClick={addLocation}>
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-2 border-t border-[var(--border)] pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Holding statuses</p>
            <p className="text-xs text-[var(--fg-muted)]">Units here are never sold, e.g. “Display unit”.</p>
          </div>
          <span className="text-xs tabular-nums text-[var(--fg-muted)]">
            {statuses.length}/{MAX_STATUSES}
          </span>
        </div>
        {statuses.map((row) => (
          <div key={row.key} className="flex max-w-md items-start gap-2">
            <Input
              aria-label="Status name"
              value={row.name}
              maxLength={MAX_STATUS_LENGTH}
              placeholder="e.g. Display unit"
              onChange={(e) => updateStatus(row.key, e.target.value)}
              error={!row.name.trim() ? 'Name is required' : undefined}
            />
            <button
              type="button"
              onClick={() => (savedIds.has(row.id) ? setConfirmRemove(row) : removeStatus(row.key))}
              className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
              aria-label={`Remove ${row.name || 'status'}`}
            >
              <SiteIcon name="trash" size={14} />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={statuses.length >= MAX_STATUSES}
          onClick={() => setStatuses((prev) => [...prev, { key: nextKey(), id: '', name: '' }])}
        >
          <SiteIcon name="plus" size={14} /> Add status
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title={`Remove “${confirmRemove?.name || 'status'}”?`}
        description="If units are still held in this status, move them in Inventory first. Nothing changes until you save."
        confirmLabel="Remove"
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) removeStatus(confirmRemove.key)
          setConfirmRemove(null)
        }}
      />
    </SettingsCard>
  )
}
