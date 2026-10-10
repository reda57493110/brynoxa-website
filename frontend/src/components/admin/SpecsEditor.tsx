import { useEffect, useState, type ReactNode } from 'react'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import {
  SPEC_FIELDS,
  SPEC_GROUPS,
  SPEC_TEMPLATES,
  customFieldClash,
  getTemplate,
  isFieldVisible,
  newCustomSpec,
  type SpecContext,
  type SpecDraft,
  type SpecField,
  type SpecGroupId,
} from '@/lib/specs'

const inputCls =
  'h-10 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg)] outline-none ring-brand placeholder:text-[var(--fg-muted)]/70'

function splitMulti(v: string) {
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function MultiInput({ field, value, onChange }: { field: SpecField; value: string; onChange: (v: string) => void }) {
  const [other, setOther] = useState('')
  const picked = splitMulti(value)
  const set = (list: string[]) => onChange(list.join(', '))
  const chips = [...(field.options ?? []), ...picked.filter((p) => !field.options?.includes(p))]
  const addOther = () => {
    const v = other.trim().replace(/,/g, ' ')
    if (v && !picked.includes(v)) set([...picked, v])
    setOther('')
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {chips.map((o) => {
          const on = picked.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => set(on ? picked.filter((p) => p !== o) : [...picked, o])}
              className={cn(
                'h-8 rounded-full border px-2.5 text-xs transition',
                on
                  ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] font-medium text-[var(--brand-text)]'
                  : 'border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--brand)]'
              )}
            >
              {on ? '✓ ' : ''}
              {o}
            </button>
          )
        })}
      </div>
      <div className="flex gap-2">
        <input
          className={cn(inputCls, 'h-8 text-xs')}
          placeholder="Other…"
          value={other}
          onChange={(e) => setOther(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addOther()
            }
          }}
          aria-label={`Add another ${field.label.en}`}
        />
        <button
          type="button"
          onClick={addOther}
          disabled={!other.trim()}
          className="h-8 shrink-0 rounded-full border border-[var(--border)] px-3 text-xs disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function FieldInput({
  field,
  value,
  onChange,
  invalid,
  idPrefix = 'spec',
}: {
  field: SpecField
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  idPrefix?: string
}) {
  const id = `${idPrefix}-${field.key}`
  const errCls = invalid && 'border-[var(--danger)]'
  switch (field.type) {
    case 'number':
      return (
        <div className="relative">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            step={field.step ?? 'any'}
            value={value}
            onKeyDown={(e) => {
              // No exponent or sign characters in spec numbers
              if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault()
            }}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputCls, field.unit && 'pe-14', errCls)}
            placeholder={field.placeholder}
            aria-invalid={invalid || undefined}
          />
          {field.unit ? (
            <span className="pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-medium text-[var(--fg-muted)]">
              {field.unit === '"' ? 'inch' : field.unit}
            </span>
          ) : null}
        </div>
      )
    case 'select':
      return (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, errCls)}>
          <option value="">—</option>
          {(field.options ?? []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          {value && !field.options?.includes(value) ? <option value={value}>{value}</option> : null}
        </select>
      )
    case 'bool':
      return (
        <div role="radiogroup" aria-labelledby={`${id}-label`} className="inline-flex rounded-full border border-[var(--border)] p-0.5">
          {[
            { v: '', l: '—' },
            { v: 'Yes', l: 'Yes' },
            { v: 'No', l: 'No' },
          ].map((o) => (
            <button
              key={o.l}
              type="button"
              role="radio"
              aria-checked={value === o.v}
              onClick={() => onChange(o.v)}
              className={cn(
                'h-8 min-w-12 rounded-full px-3 text-xs font-medium transition',
                value === o.v ? 'bg-[var(--fg)] text-[var(--bg)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'
              )}
            >
              {o.l}
            </button>
          ))}
        </div>
      )
    case 'multi':
      return <MultiInput field={field} value={value} onChange={onChange} />
    case 'combo':
      return (
        <>
          <input
            id={id}
            list={`${id}-list`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(inputCls, errCls)}
            placeholder={field.placeholder ?? 'Pick or type'}
            maxLength={500}
          />
          <datalist id={`${id}-list`}>
            {(field.options ?? []).map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </>
      )
    default:
      return (
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputCls, errCls)}
          placeholder={field.placeholder}
          maxLength={500}
        />
      )
  }
}

function Group({
  title,
  filled,
  total,
  open,
  onToggle,
  children,
}: {
  title: string
  filled: number
  total: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start">
        <span className="text-sm font-medium">{title}</span>
        <span className="flex items-center gap-2 text-xs text-[var(--fg-muted)]">
          <span className={cn('tabular-nums', filled > 0 && 'text-[var(--success)]')}>
            {filled}/{total}
          </span>
          <SiteIcon name="chevron-down" size={14} className={cn('transition', open && 'rotate-180')} />
        </span>
      </button>
      {open ? <div className="grid gap-3 border-t border-[var(--border)] p-3 sm:grid-cols-2">{children}</div> : null}
    </div>
  )
}

/**
 * Category-based specification fields for the product form. Fields come from the template of the
 * product's category (or a type picked here); anything else is kept as a custom spec.
 */
export function SpecsEditor({
  draft,
  onChange,
  override,
  onOverride,
  autoTemplate,
  hasCategory,
  context,
  errors,
}: {
  draft: SpecDraft
  onChange: (next: SpecDraft) => void
  /** Type picked for this product ('' = follow the category). */
  override: string
  onOverride: (id: string) => void
  autoTemplate: string
  hasCategory: boolean
  context: SpecContext
  errors: Record<string, string>
}) {
  const tpl = getTemplate(draft.template)
  const values = draft.values
  const [open, setOpen] = useState<Set<SpecGroupId>>(() => new Set())

  // When the type changes: open the first section and those holding values
  useEffect(() => {
    setOpen(new Set(tpl.groups.filter((g, i) => i === 0 || g.fields.some((k) => values[k])).map((g) => g.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the type changes
  }, [tpl.id])

  // Sections with an error always open
  useEffect(() => {
    const withErrors = tpl.groups.filter((g) => g.fields.some((k) => errors[k])).map((g) => g.id)
    if (withErrors.length) setOpen((prev) => new Set([...prev, ...withErrors]))
  }, [errors, tpl.groups])

  const setValue = (key: string, v: string) => onChange({ ...draft, values: { ...values, [key]: v } })
  const setCustom = (id: string, patch: Partial<{ label: string; value: string }>) =>
    onChange({ ...draft, custom: draft.custom.map((c) => (c.id === id ? { ...c, ...patch } : c)) })

  const filledTotal = Object.values(values).filter((v) => v.trim()).length + draft.custom.filter((c) => c.label.trim() && c.value.trim()).length
  const autoLabel = getTemplate(autoTemplate).label.en

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-3 sm:col-span-2 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Specifications</p>
          <p className="text-xs text-[var(--fg-muted)]">
            {filledTotal} filled · empty fields are not shown in the shop. <span className="text-[var(--brand-text)]">★</span> = key spec
          </p>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-xs sm:w-64">
          <span className="font-medium text-[var(--fg-muted)]">Product type</span>
          <select value={override} onChange={(e) => onOverride(e.target.value)} className={inputCls}>
            <option value="">{hasCategory ? `${autoLabel} (from category)` : 'From category'}</option>
            {SPEC_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label.en}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!hasCategory && !override ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-4 text-center text-sm text-[var(--fg-muted)]">
          Choose a category above to see its specification fields.
        </p>
      ) : (
        <div className="space-y-2">
          {tpl.groups.map((g) => {
            const keys = g.fields.filter((k) => isFieldVisible(k, values, context))
            if (!keys.length) return null
            const isOpen = open.has(g.id)
            return (
              <Group
                key={g.id}
                title={SPEC_GROUPS[g.id].en}
                filled={keys.filter((k) => values[k]?.trim()).length}
                total={keys.length}
                open={isOpen}
                onToggle={() =>
                  setOpen((prev) => {
                    const next = new Set(prev)
                    if (next.has(g.id)) next.delete(g.id)
                    else next.add(g.id)
                    return next
                  })
                }
              >
                {keys.map((k) => {
                  const field = SPEC_FIELDS[k]
                  const wide = field.type === 'multi'
                  return (
                    <div key={k} className={cn('min-w-0 space-y-1', wide && 'sm:col-span-2')}>
                      <label htmlFor={`spec-${k}`} id={`spec-${k}-label`} className="flex items-baseline gap-1 text-xs font-medium">
                        {tpl.important.includes(k) ? <span className="text-[var(--brand-text)]" aria-label="Key spec">★</span> : null}
                        {field.label.en}
                        {field.unit && field.type === 'number' ? (
                          <span className="font-normal text-[var(--fg-muted)]">({field.unit === '"' ? 'inches' : field.unit})</span>
                        ) : null}
                      </label>
                      <FieldInput field={field} value={values[k] ?? ''} onChange={(v) => setValue(k, v)} invalid={Boolean(errors[k])} />
                      {errors[k] ? <p className="text-xs text-[var(--danger)]">{errors[k]}</p> : null}
                    </div>
                  )
                })}
              </Group>
            )
          })}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Custom specifications</p>
            <p className="text-xs text-[var(--fg-muted)]">For anything not listed above. Shown in the shop under “Other”.</p>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...draft, custom: [...draft.custom, newCustomSpec()] })}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-[var(--border)] px-3 text-xs font-medium hover:border-[var(--brand)] hover:text-[var(--brand-text)]"
          >
            <SiteIcon name="plus" size={12} /> Add
          </button>
        </div>
        {draft.custom.length ? (
          <ul className="mt-3 space-y-2">
            {draft.custom.map((c) => {
              const clash = customFieldClash(draft, c.label)
              return (
                <li key={c.id} className="space-y-1">
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
                    <input
                      className={cn(inputCls, errors[c.id] && !c.label.trim() && 'border-[var(--danger)]')}
                      placeholder="Name (e.g. Foldable)"
                      value={c.label}
                      maxLength={60}
                      onChange={(e) => setCustom(c.id, { label: e.target.value })}
                      aria-label="Specification name"
                    />
                    <input
                      className={cn(inputCls, errors[c.id] && !c.value.trim() && 'border-[var(--danger)]')}
                      placeholder="Value"
                      value={c.value}
                      maxLength={500}
                      onChange={(e) => setCustom(c.id, { value: e.target.value })}
                      aria-label="Specification value"
                    />
                    <button
                      type="button"
                      onClick={() => onChange({ ...draft, custom: draft.custom.filter((x) => x.id !== c.id) })}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] text-[var(--fg-muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                      aria-label={`Remove ${c.label || 'specification'}`}
                    >
                      <SiteIcon name="trash" size={14} />
                    </button>
                  </div>
                  {errors[c.id] ? (
                    <p className="text-xs text-[var(--danger)]">{errors[c.id]}</p>
                  ) : clash ? (
                    <p className="text-xs text-[var(--warning)]">Same as the “{clash}” field above — consider moving the value there.</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </section>
  )
}
