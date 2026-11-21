import { useState, type ReactNode } from 'react'
import { MANUAL_ORDER_ORIGINS, ORDER_ORIGIN_LABEL } from '@/lib/orderOrigin'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { useAdminT } from '@/store/adminLangStore'
import type { AdminKey } from '@/i18n/admin'
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
  /** Missing for staff who may not change settings: no "Save as segment" */
  onSave?: (name: string) => void
  saving: boolean
  profitVisible: boolean
}) {
  const tr = useAdminT()
  /** Phone / shop / other in the admin language; Facebook, Instagram, WhatsApp, TikTok are names */
  const originLabel = (o: (typeof MANUAL_ORDER_ORIGINS)[number]) =>
    o === 'phone' || o === 'store' || o === 'other' ? tr(`cust.origin.${o}` as AdminKey) : ORDER_ORIGIN_LABEL[o]
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
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-start text-sm font-medium"
        aria-expanded={open}
        aria-controls="customer-filters-panel"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex items-center gap-2">
          <SiteIcon name="sliders" size={16} /> {tr('cust.filters')}
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
            <Field label={tr('cust.f.type')}>
              <select className={fieldCls} value={values.type} onChange={(e) => onChange({ type: e.target.value })}>
                <option value="">{tr('cust.f.any')}</option>
                <option value="retail">{tr('cust.type.retail')}</option>
                <option value="wholesale">{tr('cust.type.wholesale')}</option>
                <option value="business">{tr('cust.type.business')}</option>
              </select>
            </Field>
            <Field label={tr('cust.f.source')}>
              <select className={fieldCls} value={values.source} onChange={(e) => onChange({ source: e.target.value })}>
                <option value="">{tr('cust.f.anywhere')}</option>
                <option value="website">{tr('cust.f.website')}</option>
                <option value="other_channels">{tr('cust.f.otherChannels')}</option>
                {MANUAL_ORDER_ORIGINS.map((o) => (
                  <option key={o} value={o}>
                    {originLabel(o)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={tr('cust.f.status')}>
              <select className={fieldCls} value={values.status} onChange={(e) => onChange({ status: e.target.value })}>
                <option value="">{tr('cust.f.any')}</option>
                <option value="active">{tr('cust.st.active')}</option>
                <option value="disabled">{tr('cust.st.disabled')}</option>
                <option value="unverified">{tr('cust.st.unverified')}</option>
                <option value="wholesale-pending">{tr('cust.st.wholesale-pending')}</option>
                <option value="guest">{tr('cust.f.guests')}</option>
                <option value="account">{tr('cust.f.withAccount')}</option>
              </select>
            </Field>
            <Field label={tr('cust.f.regFrom')}>
              <input
                type="date"
                className={fieldCls}
                value={values.registeredFrom}
                onChange={(e) => onChange({ registeredFrom: e.target.value })}
              />
            </Field>
            <Field label={tr('cust.f.regTo')}>
              <input
                type="date"
                className={fieldCls}
                value={values.registeredTo}
                onChange={(e) => onChange({ registeredTo: e.target.value })}
              />
            </Field>
            <Field label={tr('cust.f.activity')}>
              <select className={fieldCls} value={values.activity} onChange={(e) => onChange({ activity: e.target.value })}>
                <option value="">{tr('cust.f.any')}</option>
                <option value="ordered">{tr('cust.f.hasOrdered')}</option>
                <option value="never">{tr('cust.f.neverOrdered')}</option>
                <option value="active">{tr('cust.f.activeBuyers')}</option>
                <option value="inactive">{tr('cust.f.inactiveBuyers')}</option>
              </select>
            </Field>
            {num('minNet', tr('cust.f.minNet'))}
            {num('maxNet', tr('cust.f.maxNet'))}
            {num('minOrders', tr('cust.f.minOrders'))}
            {num('maxOrders', tr('cust.f.maxOrders'))}
            {profitVisible ? num('minProfit', tr('cust.f.minProfit')) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {!onSave ? null : naming ? (
              <form
                className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!name.trim()) return
                  onSave?.(name.trim())
                  setName('')
                  setNaming(false)
                }}
              >
                <input
                  autoFocus
                  aria-label={tr('cust.f.segName')}
                  placeholder={tr('cust.f.segName')}
                  maxLength={40}
                  className={cn(fieldCls, 'h-9 sm:w-56')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button type="submit" size="sm" loading={saving} disabled={!name.trim()}>
                  {tr('cust.f.save')}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setNaming(false)}>
                  {tr('cust.f.cancel')}
                </Button>
              </form>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={() => setNaming(true)}>
                <SiteIcon name="plus" size={14} /> {tr('cust.f.saveAsSegment')}
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={onClear} disabled={!activeCount}>
              {tr('cust.f.clear')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
