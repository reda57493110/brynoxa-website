import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/toastStore'
import type { InventoryStatusDef, StoreSettings } from '@/types'

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

  useEffect(() => {
    if (!settings) return
    setRequireInspection(settings.requireInspection ?? true)
    setLocations(settings.inventoryLocations ?? [])
    setStatuses(toRows(settings.inventoryStatuses))
  }, [settings])

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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold">Inventory</h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          How new stock is checked in, where it is stored, and extra statuses for units that are
          not for sale.
        </p>
      </div>

      <div className="min-w-0 space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:p-6">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={requireInspection}
            onChange={(e) => setRequireInspection(e.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium">
              New deliveries must be inspected before they can be sold
            </span>
            <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
              Received units wait in “Awaiting inspection” until someone checks them. When off,
              they go straight to available stock.
            </span>
          </span>
        </label>

        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Storage locations</p>
              <span className="text-xs tabular-nums text-[var(--fg-muted)]">
                {locations.length}/{MAX_LOCATIONS}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              Offered when you set where a product is stored (e.g. “Shop — Shelf A”, “Warehouse”).
            </p>
          </div>
          {locations.length ? (
            <ul className="flex flex-wrap gap-2">
              {locations.map((loc) => (
                <li
                  key={loc}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--bg-muted)]/50 ps-3 pe-1 py-1 text-sm"
                >
                  <span className="min-w-0 truncate">{loc}</span>
                  <button
                    type="button"
                    onClick={() => setLocations((prev) => prev.filter((l) => l !== loc))}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--fg-muted)] transition hover:bg-[var(--bg-muted)] hover:text-[var(--danger)]"
                    aria-label={`Remove location ${loc}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--fg-muted)]">No locations yet.</p>
          )}
          <div className="flex items-end gap-2">
            <Input
              label="New location"
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
              error={draft && draftDuplicate ? 'This location is already in the list' : undefined}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              disabled={!canAddLocation}
              title={locations.length >= MAX_LOCATIONS ? `Up to ${MAX_LOCATIONS} locations` : undefined}
              onClick={addLocation}
            >
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium">Custom holding statuses</p>
              <span className="text-xs tabular-nums text-[var(--fg-muted)]">
                {statuses.length}/{MAX_STATUSES}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
              Extra places to park units, e.g. “Display unit” or “On loan”. Units in a custom status
              are never sold.
            </p>
          </div>
          {statuses.map((row) => (
            <div key={row.key} className="flex items-end gap-2">
              <Input
                label={row.id ? 'Status name' : 'New status name'}
                value={row.name}
                maxLength={MAX_STATUS_LENGTH}
                placeholder="e.g. Display unit"
                onChange={(e) => updateStatus(row.key, e.target.value)}
                error={!row.name.trim() ? 'Name is required' : undefined}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mb-1.5 shrink-0"
                onClick={() =>
                  savedIds.has(row.id) ? setConfirmRemove(row) : removeStatus(row.key)
                }
              >
                Remove
              </Button>
            </div>
          ))}
          {duplicateStatus ? (
            <p className="text-xs text-[var(--danger)]">Two statuses have the same name — make each name unique.</p>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={statuses.length >= MAX_STATUSES}
            title={statuses.length >= MAX_STATUSES ? `Up to ${MAX_STATUSES} statuses` : undefined}
            onClick={() => setStatuses((prev) => [...prev, { key: nextKey(), id: '', name: '' }])}
          >
            Add status
          </Button>
        </div>

        <Button type="button" onClick={() => save.mutate()} loading={save.isPending} disabled={invalid}>
          Save inventory settings
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title={`Remove “${confirmRemove?.name || 'status'}”?`}
        description="Check Admin → Inventory first: if units are still held in this status, move them to another status before you save, or they will no longer be listed under a status you can see. Nothing changes until you save."
        confirmLabel="Remove"
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) removeStatus(confirmRemove.key)
          setConfirmRemove(null)
        }}
      />
    </section>
  )
}
