import type { ReactNode } from 'react'
import type { Brand, Category } from '@/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayName } from '@/i18n'

export interface FilterValues {
  category?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  inStock?: boolean
}

const PRICE_PRESETS: Array<{ min?: string; max?: string }> = [
  { max: '500' },
  { max: '1500' },
  { max: '3000' },
  { min: '5000' },
]

const ALL_CAPS = new Set(['hp', 'msi', 'lg', 'ibm', 'amd', 'cpu', 'gpu', 'ssd', 'hdd', 'usb'])

function displayBrand(name: string) {
  const trimmed = name.trim()
  if (!trimmed) return name
  if (ALL_CAPS.has(trimmed.toLowerCase())) return trimmed.toUpperCase()
  return trimmed
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function FilterSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: 'layers' | 'boxes' | 'tag' | 'package-check'
  children: ReactNode
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--brand-text)]">
          <SiteIcon name={icon} size={14} />
        </span>
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          {title}
        </h3>
      </div>
      {children}
    </section>
  )
}

function OptionRow({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
        active
          ? 'bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] font-semibold text-[var(--brand-text)]'
          : 'text-[var(--fg)] hover:bg-[var(--bg-muted)]'
      )}
    >
      <span className="truncate">{label}</span>
      {active ? <SiteIcon name="check" size={14} className="shrink-0 text-[var(--brand-text)]" /> : null}
    </button>
  )
}

export function FilterSidebar({
  categories,
  brands,
  values,
  onChange,
  onClear,
  plain = false,
}: {
  categories: Category[]
  brands: Brand[]
  values: FilterValues
  onChange: (next: FilterValues) => void
  onClear: () => void
  plain?: boolean
}) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const activeCount = [
    values.category,
    values.brand,
    values.minPrice,
    values.maxPrice,
    values.inStock,
  ].filter(Boolean).length
  const hasActive = activeCount > 0

  const presetActive = (preset: { min?: string; max?: string }) =>
    (preset.min || '') === (values.minPrice || '') &&
    (preset.max || '') === (values.maxPrice || '')

  return (
    <aside
      className={cn(
        'space-y-5',
        !plain &&
          'rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight">{t('shop.filters')}</h2>
          {hasActive ? <Badge variant="brand">{activeCount}</Badge> : null}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={!hasActive}
          className="shrink-0"
        >
          {t('ui.clear')}
        </Button>
      </div>

      <button
        type="button"
        onClick={() => onChange({ ...values, inStock: values.inStock ? undefined : true })}
        className={cn(
          'flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
          values.inStock
            ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_14%,transparent)]'
            : 'border-[var(--border)] hover:border-[var(--brand)]'
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl',
            values.inStock
              ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
              : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]'
          )}
        >
          <SiteIcon name="package-check" size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t('shop.inStockOnly')}</span>
          <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
            {values.inStock ? t('stock.inStock') : t('shop.any')}
          </span>
        </span>
        <span
          className={cn(
            'relative h-6 w-11 shrink-0 rounded-full transition',
            values.inStock ? 'bg-[var(--brand)]' : 'bg-[var(--bg-muted)]'
          )}
          aria-hidden
        >
          <span
            className={cn(
              'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition',
              values.inStock ? 'start-[1.35rem]' : 'start-0.5'
            )}
          />
        </span>
      </button>

      <div className="h-px bg-[var(--border)]" />

      <FilterSection title={t('shop.category')} icon="layers">
        <div className="max-h-56 space-y-0.5 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 p-1.5">
          <OptionRow
            active={!values.category}
            label={t('shop.allCategories')}
            onClick={() => onChange({ ...values, category: undefined })}
          />
          {categories.map((c) => (
            <OptionRow
              key={c._id}
              active={values.category === c.slug}
              label={categoryDisplayName(locale, c.slug, c.name)}
              onClick={() =>
                onChange({
                  ...values,
                  category: values.category === c.slug ? undefined : c.slug,
                })
              }
            />
          ))}
        </div>
      </FilterSection>

      {brands.length > 0 ? (
        <FilterSection title={t('shop.brand')} icon="boxes">
          <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 p-1.5">
            <OptionRow
              active={!values.brand}
              label={t('shop.all')}
              onClick={() => onChange({ ...values, brand: undefined })}
            />
            {brands.map((b) => (
              <OptionRow
                key={b._id}
                active={values.brand === b.slug}
                label={displayBrand(b.name)}
                onClick={() =>
                  onChange({
                    ...values,
                    brand: values.brand === b.slug ? undefined : b.slug,
                  })
                }
              />
            ))}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title={t('shop.priceDh')} icon="tag">
        <div className="grid grid-cols-2 gap-1.5">
          {PRICE_PRESETS.map((preset) => {
            const label = preset.max
              ? t('shop.under', { amount: Number(preset.max).toLocaleString('fr-MA') })
              : `${Number(preset.min).toLocaleString('fr-MA')}+ DH`
            const active = presetActive(preset)
            return (
              <button
                key={`${preset.min || ''}-${preset.max || ''}`}
                type="button"
                onClick={() =>
                  onChange({
                    ...values,
                    minPrice: active ? undefined : preset.min,
                    maxPrice: active ? undefined : preset.max,
                  })
                }
                className={cn(
                  'h-10 rounded-xl border px-2 text-xs font-semibold transition',
                  active
                    ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                    : 'border-[var(--border)] text-[var(--fg)] hover:border-[var(--brand)]'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            {t('shop.customRange')}
          </p>
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 space-y-1 text-xs">
              <span className="font-medium text-[var(--fg-muted)]">{t('shop.min')}</span>
              <input
                type="number"
                min={0}
                value={values.minPrice || ''}
                onChange={(e) => onChange({ ...values, minPrice: e.target.value || undefined })}
                placeholder="0"
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm outline-none ring-brand"
              />
            </label>
            <span className="pb-2.5 text-sm text-[var(--fg-muted)]">–</span>
            <label className="min-w-0 flex-1 space-y-1 text-xs">
              <span className="font-medium text-[var(--fg-muted)]">{t('shop.max')}</span>
              <input
                type="number"
                min={0}
                value={values.maxPrice || ''}
                onChange={(e) => onChange({ ...values, maxPrice: e.target.value || undefined })}
                placeholder={t('shop.any')}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm outline-none ring-brand"
              />
            </label>
          </div>
        </div>
      </FilterSection>
    </aside>
  )
}
