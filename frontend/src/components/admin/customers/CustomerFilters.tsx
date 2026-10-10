import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { cardClass } from './shared'
import { FILTER_KEYS, type FilterKey, type FilterValues } from './utils'


const fieldCls =
  'h-10 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg)] outline-none ring-brand'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-[var(--fg-muted)]">
      {label}
      {children}
    </label>
  )
}

export function CustomerFilters({
  values,
  onChange,
  onClear,
  onSave,
  saving,
  profitVisible,
}: {
  values: FilterValues
  onChange: (patch: Partial<FilterValues>) => void
  onClear: () => void
  onSave: (name: string) => void
  saving: boolean
  profitVisible: boolean
}) {
  const activeCount = FILTER_KEYS.filter((k) => values[k]).length
  const [open, setOpen] = useState(activeCount > 0)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const num = (k: FilterKey, label: string) => (
    <Field label={label}>
      <input
        type="number"
        min={0}
        inputMode="decimal"
        className={fieldCls}
        value={values[k]}
        onChange={(e) => onChange({ [k]: e.target.value })}
      />
    </Field>
  )

  return (
    <div className={cn(cardClass, 'min-w-0')}>
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
        aria-expanded={open}
        aria-controls="customer-filters-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex items-center gap-2">
          <SiteIcon name="sliders" size={16} /> Filters
          {activeCount ? (
            <span className="rounded-full bg-[var(--bg-muted)] px-2 text-xs text-[var(--brand-text)]">
              {activeCount}
            </span>
          ) : null}
        </span>
        <SiteIcon name="chevron-down" size={16} className={cn('transition', open && 'rotate-180')} />
      </button>
      {open ? (
        <div id="customer-filters-panel" className="border-t border-[var(--border)] p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Customer type">
              <select className={fieldCls} value={values.type} onChange={(e) => onChange({ type: e.target.value })}>
                <option value="">Any</option>
                <option value="retail">Retail</option>
                <option value="wholesale">Wholesale</option>
                <option value="business">Business</option>
              </select>
            </Field>
            <Field label="Account status">
              <select className={fieldCls} value={values.status} onChange={(e) => onChange({ status: e.target.value })}>
                <option value="">Any</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
                <option value="unverified">Unverified</option>
                <option value="wholesale-pending">Wholesale pending</option>
              </select>
            </Field>
            <Field label="Registered from">
              <input
                type="date"
                className={fieldCls}
                value={values.registeredFrom}
                onChange={(e) => onChange({ registeredFrom: e.target.value })}
              />
            </Field>
            <Field label="Registered to">
              <input
                type="date"
                className={fieldCls}
                value={values.registeredTo}
                onChange={(e) => onChange({ registeredTo: e.target.value })}
              />
            </Field>
            <Field label="Order activity">
              <select className={fieldCls} value={values.activity} onChange={(e) => onChange({ activity: e.target.value })}>
                <option value="">Any</option>
                <option value="ordered">Has ordered</option>
                <option value="never">Never ordered</option>
                <option value="active">Active buyers</option>
                <option value="inactive">Inactive buyers</option>
              </select>
            </Field>
            {num('minNet', 'Min net sales (DH)')}
            {num('maxNet', 'Max net sales (DH)')}
            {num('minOrders', 'Min completed orders')}
            {num('maxOrders', 'Max completed orders')}
            {profitVisible ? num('minProfit', 'Min gross profit (DH)') : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {naming ? (
              <form
                className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!name.trim()) return
                  onSave(name.trim())
                  setName('')
                  setNaming(false)
                }}
              >
                <input
                  autoFocus
                  aria-label="Segment name"
                  placeholder="Segment name"
                  maxLength={40}
                  className={cn(fieldCls, 'h-9 sm:w-56')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button type="submit" size="sm" loading={saving} disabled={!name.trim()}>
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNaming(false)}>
                  Cancel
                </Button>
              </form>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => setNaming(true)}>
                <SiteIcon name="plus" size={14} /> Save as segment
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onClear} disabled={!activeCount}>
              Clear filters
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
