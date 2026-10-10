import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatCurrency } from '@/lib/format'
import { toast } from '@/store/toastStore'
import type { SavedSegment, SegmentSettings, StoreSettings } from '@/types'
import { SaveBar, SettingsCard } from './settings/SettingsUi'
import { useReportDirty } from './settings/dirty'

const DEFAULTS: SegmentSettings = {
  newDays: 30,
  inactiveDays: 90,
  highSpendMin: 20000,
  highProfitMin: 5000,
  saved: [],
}

const SEGMENT_LABELS: Record<string, string> = {
  new: 'New',
  repeat: 'Repeat',
  'high-spend': 'High-spending',
  'high-profit': 'High-profit',
  inactive: 'Inactive',
  wholesale: 'Wholesale',
  'wholesale-pending': 'Wholesale pending',
  outstanding: 'Unpaid balance',
}

const ACTIVITY_LABELS: Record<string, string> = {
  ordered: 'has ordered',
  never: 'never ordered',
  active: 'active',
  inactive: 'inactive',
}

const SORT_LABELS: Record<string, string> = {
  spent: 'total spent',
  net: 'net sales',
  profit: 'profit',
  orders: 'orders',
  lastOrder: 'last order',
  registered: 'registration date',
  name: 'name',
}

/** Turn a saved segment's filter object into short, readable phrases. */
function describeFilters(filters: Record<string, string | number>): string[] {
  const parts: string[] = []
  const f = filters
  const has = (k: string) => f[k] !== undefined && f[k] !== ''
  const money = (k: string) => formatCurrency(Number(f[k]))
  if (has('q')) parts.push(`Search “${f.q}”`)
  if (has('segment')) parts.push(`Segment: ${SEGMENT_LABELS[String(f.segment)] ?? f.segment}`)
  if (has('type')) parts.push(`Type: ${f.type}`)
  if (has('status')) parts.push(`Status: ${String(f.status).replace('-', ' ')}`)
  if (has('activity')) parts.push(`Activity: ${ACTIVITY_LABELS[String(f.activity)] ?? f.activity}`)
  if (has('registeredFrom') || has('registeredTo')) {
    parts.push(`Registered ${f.registeredFrom ?? '…'} → ${f.registeredTo ?? '…'}`)
  }
  if (has('from') || has('to')) parts.push(`Orders ${f.from ?? '…'} → ${f.to ?? '…'}`)
  if (has('minOrders') && has('maxOrders')) parts.push(`${f.minOrders}–${f.maxOrders} orders`)
  else if (has('minOrders')) parts.push(`≥ ${f.minOrders} orders`)
  else if (has('maxOrders')) parts.push(`≤ ${f.maxOrders} orders`)
  if (has('minNet') && has('maxNet')) parts.push(`Net sales ${money('minNet')}–${money('maxNet')}`)
  else if (has('minNet')) parts.push(`Net sales ≥ ${money('minNet')}`)
  else if (has('maxNet')) parts.push(`Net sales ≤ ${money('maxNet')}`)
  if (has('minProfit')) parts.push(`Profit ≥ ${money('minProfit')}`)
  if (has('sort')) {
    parts.push(
      `Sorted by ${SORT_LABELS[String(f.sort)] ?? f.sort}${f.dir === 'asc' ? ' (ascending)' : ''}`
    )
  }
  const known = new Set([
    'q', 'segment', 'type', 'status', 'activity', 'registeredFrom', 'registeredTo', 'from', 'to',
    'minOrders', 'maxOrders', 'minNet', 'maxNet', 'minProfit', 'sort', 'dir', 'page', 'limit',
  ])
  for (const [k, v] of Object.entries(f)) {
    if (!known.has(k) && v !== '') parts.push(`${k}: ${v}`)
  }
  return parts
}

const intError = (value: string) => {
  const n = Number(value)
  return value.trim() === '' || !Number.isInteger(n) || n < 1 || n > 3650
    ? 'Whole number from 1 to 3650'
    : undefined
}

const moneyError = (value: string) => {
  const n = Number(value)
  return value.trim() === '' || !Number.isFinite(n) || n < 0 ? 'Enter 0 or more' : undefined
}

/** Admin: thresholds behind the built-in customer segments, and saved custom segments. */
export function CustomerSegmentSettings({ settings }: { settings?: StoreSettings }) {
  const qc = useQueryClient()
  const [newDays, setNewDays] = useState('')
  const [inactiveDays, setInactiveDays] = useState('')
  const [highSpendMin, setHighSpendMin] = useState('')
  const [highProfitMin, setHighProfitMin] = useState('')
  const [saved, setSaved] = useState<SavedSegment[]>([])

  const reset = useCallback(() => {
    if (!settings) return
    const s = { ...DEFAULTS, ...settings.customerSegments }
    setNewDays(String(s.newDays))
    setInactiveDays(String(s.inactiveDays))
    setHighSpendMin(String(s.highSpendMin))
    setHighProfitMin(String(s.highProfitMin))
    setSaved(s.saved ?? [])
  }, [settings])
  useEffect(reset, [reset])

  const save = useMutation({
    mutationFn: () =>
      adminApi.settings.update({
        customerSegments: {
          newDays: Number(newDays),
          inactiveDays: Number(inactiveDays),
          highSpendMin: Number(highSpendMin),
          highProfitMin: Number(highProfitMin),
          saved,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['admin-customers'] })
      toast.success('Customer segments saved')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const errors = {
    newDays: intError(newDays),
    inactiveDays: intError(inactiveDays),
    highSpendMin: moneyError(highSpendMin),
    highProfitMin: moneyError(highProfitMin),
  }
  const invalid = Object.values(errors).some(Boolean)
  const savedCount = settings?.customerSegments?.saved?.length ?? 0

  const base = { ...DEFAULTS, ...settings?.customerSegments }
  const dirty =
    Boolean(settings) &&
    (newDays !== String(base.newDays) ||
      inactiveDays !== String(base.inactiveDays) ||
      highSpendMin !== String(base.highSpendMin) ||
      highProfitMin !== String(base.highProfitMin) ||
      saved.length !== savedCount)
  useReportDirty('segments', dirty)

  return (
    <SettingsCard
      title="Customer segments"
      description="Rules behind the segment filters in Customers."
      footer={
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          invalid={invalid}
          error={invalid ? 'Fix the highlighted fields' : undefined}
          onReset={reset}
          onSave={() => save.mutate()}
        />
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="New = registered within (days)"
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          step={1}
          value={newDays}
          onChange={(e) => setNewDays(e.target.value)}
          error={errors.newDays}
        />
        <Input
          label="Inactive after (days without order)"
          type="number"
          inputMode="numeric"
          min={1}
          max={3650}
          step={1}
          value={inactiveDays}
          onChange={(e) => setInactiveDays(e.target.value)}
          error={errors.inactiveDays}
        />
        <Input
          label="High-spending from (DH net sales)"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={highSpendMin}
          onChange={(e) => setHighSpendMin(e.target.value)}
          error={errors.highSpendMin}
        />
        <Input
          label="High-profit from (DH gross profit)"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          value={highProfitMin}
          onChange={(e) => setHighProfitMin(e.target.value)}
          error={errors.highProfitMin}
        />
      </div>

      <div className="space-y-2 border-t border-[var(--border)] pt-4">
        <p className="text-sm font-medium">Saved segments</p>
        {saved.length === 0 ? (
          <p className="text-xs text-[var(--fg-muted)]">
            {savedCount > 0 ? 'All removed — save to confirm.' : 'None yet. Save a filtered list from Customers.'}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
            {saved.map((seg, i) => {
              const parts = describeFilters(seg.filters ?? {})
              return (
                <li key={seg.id || `${seg.name}-${i}`} className="flex min-w-0 items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">{seg.name}</p>
                    <p className="break-words text-xs text-[var(--fg-muted)]">{parts.length ? parts.join(' · ') : 'All customers'}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0"
                    onClick={() => setSaved((prev) => prev.filter((_, j) => j !== i))}
                  >
                    Delete
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </SettingsCard>
  )
}
