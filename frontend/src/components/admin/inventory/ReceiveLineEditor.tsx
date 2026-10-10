import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Textarea } from '@/components/ui/Textarea'
import { formatCurrency } from '@/lib/format'
import type { LineAnalysis, ReceiveLineState, UnitResult } from './ReceiveLine'
import { UNIT_RESULT_OPTIONS } from './ReceiveLine'
import { nativeSelect } from './MovementLabels'
import { ReceiveProductPicker } from './ReceiveProductPicker'

export function ReceiveLineEditor({
  index,
  line,
  analysis,
  requireInspection,
  showErrors,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number
  line: ReceiveLineState
  analysis: LineAnalysis
  requireInspection: boolean
  showErrors: boolean
  canRemove: boolean
  onChange: (patch: Partial<ReceiveLineState>) => void
  onRemove: () => void
}) {
  const { counts, errors, qty } = analysis
  const p = line.product
  const err = (k: keyof LineAnalysis['errors']) => (showErrors ? errors[k] : undefined)
  const defaultResult: UnitResult = requireInspection ? 'awaitingInspection' : 'available'

  const setAll = (result: UnitResult) => {
    const next = { ...line.unitResults }
    for (const s of analysis.serials) next[s] = { fault: next[s]?.fault ?? '', result }
    onChange({ unitResults: next })
  }

  return (
    <fieldset className="min-w-0 space-y-3 rounded-xl border border-[var(--border)] p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold">Line {index + 1}</legend>
        {canRemove ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} aria-label={`Remove line ${index + 1}`}>
            <SiteIcon name="trash" size={14} /> Remove
          </Button>
        ) : null}
      </div>

      {p ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{p.name}</span>
            <span className="block truncate text-xs text-[var(--fg-muted)]">{p.sku}</span>
          </span>
          {p.condition ? <Badge variant={p.condition === 'new' ? 'muted' : 'warning'}>{p.condition}</Badge> : null}
          {p.serialTracking ? <Badge variant="brand">Serials required</Badge> : null}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange({ product: null, unitResults: {} })}>
            Change
          </Button>
        </div>
      ) : (
        <ReceiveProductPicker onPick={(prod) => onChange({ product: prod, unitResults: {} })} error={err('product')} />
      )}

      <div className="grid min-w-0 gap-3 sm:grid-cols-3">
        <Input
          label="Quantity"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={line.qty}
          onChange={(e) => onChange({ qty: e.target.value })}
          error={err('qty')}
        />
        <Input
          label="Unit cost (DH)"
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          placeholder="Optional"
          value={line.unitCost}
          onChange={(e) => onChange({ unitCost: e.target.value })}
          error={err('cost')}
        />
        <Input
          label="Warranty"
          placeholder="e.g. 24 months supplier"
          maxLength={200}
          value={line.warranty}
          onChange={(e) => onChange({ warranty: e.target.value })}
        />
      </div>

      <Textarea
        label={p?.serialTracking ? 'Serial numbers (one per line, required)' : 'Serial numbers (optional, one per line)'}
        rows={3}
        className="min-h-20 font-mono text-xs"
        value={line.serialsText}
        onChange={(e) => onChange({ serialsText: e.target.value })}
        error={showErrors || (p?.serialTracking && analysis.serials.length > qty) ? errors.serials : undefined}
      />

      {analysis.perSerial ? (
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">Inspection per unit</p>
            <label className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
              Set all
              <select
                className="h-9 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs text-[var(--fg)]"
                value=""
                onChange={(e) => e.target.value && setAll(e.target.value as UnitResult)}
              >
                <option value="">Choose…</option>
                {UNIT_RESULT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {analysis.serials.map((serial) => {
              const r = line.unitResults[serial]
              const result = r?.result ?? defaultResult
              const needsFault = result === 'defective' || result === 'underRepair'
              return (
                <li key={serial} className="grid min-w-0 gap-2 rounded-lg border border-[var(--border)] p-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                  <span className="self-center truncate font-mono text-xs">{serial}</span>
                  <select
                    aria-label={`Result for ${serial}`}
                    className={nativeSelect}
                    value={result}
                    onChange={(e) =>
                      onChange({
                        unitResults: { ...line.unitResults, [serial]: { fault: r?.fault ?? '', result: e.target.value as UnitResult } },
                      })
                    }
                  >
                    {UNIT_RESULT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {needsFault ? (
                    <input
                      aria-label={`Fault for ${serial}`}
                      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm sm:col-span-2"
                      placeholder="Fault (optional)"
                      maxLength={300}
                      value={r?.fault ?? ''}
                      onChange={(e) =>
                        onChange({ unitResults: { ...line.unitResults, [serial]: { result, fault: e.target.value } } })
                      }
                    />
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>
      ) : (
        <div className="min-w-0 space-y-2">
          <p className="text-sm font-medium">Inspection results</p>
          <div className="grid min-w-0 grid-cols-3 gap-2">
            <Input
              label="Passed"
              type="number"
              inputMode="numeric"
              min={0}
              value={line.passed}
              placeholder="0"
              onChange={(e) => onChange({ passed: e.target.value })}
            />
            <Input
              label="Defective"
              type="number"
              inputMode="numeric"
              min={0}
              value={line.defective}
              placeholder="0"
              onChange={(e) => onChange({ defective: e.target.value })}
            />
            <Input
              label="To repair"
              type="number"
              inputMode="numeric"
              min={0}
              value={line.repair}
              placeholder="0"
              onChange={(e) => onChange({ repair: e.target.value })}
            />
          </div>
          {errors.counts ? (
            <p role="alert" className="text-xs text-[var(--danger)]">
              {errors.counts}
            </p>
          ) : null}
          {p?.serialTracking ? (
            <p className="text-xs text-[var(--fg-muted)]">Enter the serials above to record a result per unit.</p>
          ) : null}
        </div>
      )}

      <Textarea
        label="Fault notes"
        rows={2}
        className="min-h-16"
        maxLength={500}
        placeholder="Optional — what was wrong"
        value={line.faultNotes}
        onChange={(e) => onChange({ faultNotes: e.target.value })}
      />

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg-muted)] px-3 py-2 text-sm" aria-live="polite">
        <span className="min-w-0 break-words">
          <strong>{qty}</strong> received = {counts.available} sellable + {counts.defective} defective + {counts.underRepair} to repair +{' '}
          {counts.awaitingInspection} to inspect
        </span>
        <span className="tabular-nums font-semibold">{analysis.total !== null ? formatCurrency(analysis.total) : '—'}</span>
      </div>
    </fieldset>
  )
}
