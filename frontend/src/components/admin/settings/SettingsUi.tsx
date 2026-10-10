import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

export { Panel as SettingsCard } from '../Panel'

/** Card footer: unsaved-changes state, Reset (back to the saved values) and Save. */
export function SaveBar({
  dirty,
  saving,
  invalid,
  onSave,
  onReset,
  error,
}: {
  dirty: boolean
  saving: boolean
  invalid?: boolean
  onSave: () => void
  onReset: () => void
  /** Why saving is blocked (shown instead of the status). */
  error?: string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--bg-muted)]/30 px-4 py-2.5 sm:px-5">
      <p className={cn('text-xs', error ? 'text-[var(--danger)]' : dirty ? 'text-[var(--warning)]' : 'text-[var(--fg-muted)]')} aria-live="polite">
        {error ? error : dirty ? '● Unsaved changes' : 'All changes saved'}
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={!dirty || saving} onClick={onReset}>
          Reset
        </Button>
        <Button type="button" size="sm" disabled={!dirty || invalid} loading={saving} onClick={onSave}>
          Save changes
        </Button>
      </div>
    </div>
  )
}

/** On/off switch with a label and an optional one-line hint. */
export function Switch({
  checked,
  onChange,
  label,
  hint,
  badge,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  hint?: string
  badge?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">
          {label}
          {badge ? <span className="ms-2 rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--fg-muted)]">{badge}</span> : null}
        </span>
        {hint ? <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">{hint}</span> : null}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span
          aria-hidden
          className="h-5 w-9 rounded-full bg-[var(--border)] transition peer-checked:bg-[var(--brand)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brand)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--bg-elevated)]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute start-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4 rtl:peer-checked:-translate-x-4"
        />
      </span>
    </label>
  )
}
