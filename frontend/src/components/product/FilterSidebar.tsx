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
  { max: '1000' },
  { min: '1000', max: '5000' },
  { min: '5000', max: '15000' },
  { min: '15000' },
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
  compact,
  children,
}: {
  title: string
  icon: 'layers' | 'boxes' | 'tag' | 'package-check'
  compact: boolean
  children: ReactNode
}) {
  return (
    <section className={compact ? 'space-y-2' : 'space-y-2.5'}>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex items-center justify-center rounded-lg bg-[var(--bg-muted)] text-[var(--brand-text)]',
            compact ? 'h-6 w-6' : 'h-7 w-7'
          )}
        >
          <SiteIcon name={icon} size={compact ? 12 : 14} />
        </span>
        <h3 className={cn('font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]', compact ? 'text-[11px]' : 'text-xs')}>
          {title}
        </h3>
      </div>
      {children}
    </section>
  )
}

/** A choice as a pill; the chosen one is filled in the brand colour. */
function OptionChip({
  active,
  label,
  compact,
  onClick,
}: {
  active: boolean
  label: string
  compact: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border font-medium transition active:scale-[0.97]',
        compact ? 'h-8 px-3 text-[13px]' : 'h-10 px-3.5 text-sm',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
        active
          ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow'
          : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--brand)] hover:text-[var(--brand-text)]'
      )}
    >
      {active ? <SiteIcon name="check" size={compact ? 12 : 14} className="shrink-0" /> : null}
      <span className="truncate">{label}</span>
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
  hideCategories = false,
}: {
  categories: Category[]
  brands: Brand[]
  values: FilterValues
  onChange: (next: FilterValues) => void
  onClear: () => void
  plain?: boolean
  hideCategories?: boolean
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
  // Computer sidebar: a little smaller; the phone drawer (`plain`) keeps big touch targets
  const compact = !plain

  const presetActive = (preset: { min?: string; max?: string }) =>
    (preset.min || '') === (values.minPrice || '') &&
    (preset.max || '') === (values.maxPrice || '')

  return (
    <aside
      className={cn(
        plain ? 'space-y-5' : 'space-y-4 rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-soft'
      )}
    >
      <div className={cn('flex items-center justify-between gap-3', plain && 'hidden')}>
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">{t('shop.filters')}</h2>
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
          'flex w-full items-start gap-2.5 rounded-2xl border text-left transition',
          compact ? 'px-2.5 py-2' : 'px-3 py-3',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
          values.inStock
            ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_14%,transparent)]'
            : 'border-[var(--border)] hover:border-[var(--brand)]'
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex shrink-0 items-center justify-center rounded-xl',
            compact ? 'h-7 w-7' : 'h-8 w-8',
            values.inStock
              ? 'bg-[var(--brand)] text-[var(--brand-fg)]'
              : 'bg-[var(--bg-muted)] text-[var(--fg-muted)]'
          )}
        >
          <SiteIcon name="package-check" size={compact ? 13 : 15} />
        </span>
        <span className="min-w-0 flex-1 pr-1">
          <span className={cn('block font-semibold leading-snug', compact ? 'text-[13px]' : 'text-sm')}>{t('shop.inStockOnly')}</span>
          <span className={cn('block leading-snug text-[var(--fg-muted)]', compact ? 'mt-0.5 text-[11px]' : 'mt-1 text-xs')}>
            {values.inStock ? t('stock.inStock') : t('shop.any')}
          </span>
        </span>
        <span
          className={cn(
            'relative mt-0.5 shrink-0 rounded-full transition',
            compact ? 'h-5 w-9' : 'h-6 w-11',
            values.inStock ? 'bg-[var(--brand)]' : 'bg-[var(--bg-muted)]'
          )}
          aria-hidden
        >
          <span
            className={cn(
              'absolute top-0.5 rounded-full bg-white shadow transition',
              compact ? 'h-4 w-4' : 'h-5 w-5',
              values.inStock ? (compact ? 'start-[1.15rem]' : 'start-[1.35rem]') : 'start-0.5'
            )}
          />
        </span>
      </button>

      <div className="h-px bg-[var(--border)]" />

      {!hideCategories ? (
        <FilterSection compact={compact} title={t('shop.category')} icon="layers">
          <div className="flex flex-wrap gap-2">
            <OptionChip
                compact={compact}
              active={!values.category}
              label={t('shop.allCategories')}
              onClick={() => onChange({ ...values, category: undefined })}
            />
            {categories.map((c) => (
              <OptionChip
                compact={compact}
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
      ) : null}

      {brands.length > 0 ? (
        <FilterSection compact={compact} title={t('shop.brand')} icon="boxes">
          <div className="flex flex-wrap gap-2">
            <OptionChip
                compact={compact}
              active={!values.brand}
              label={t('shop.all')}
              onClick={() => onChange({ ...values, brand: undefined })}
            />
            {brands.map((b) => (
              <OptionChip
                compact={compact}
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

      <FilterSection compact={compact} title={t('shop.priceDh')} icon="tag">
        <div className={cn('grid gap-2', plain ? 'grid-cols-2' : 'grid-cols-1')}>
          {PRICE_PRESETS.map((preset) => {
            const label =
              preset.max && !preset.min
                ? t('shop.under', { amount: Number(preset.max).toLocaleString('fr-MA') })
                : preset.min && !preset.max
                  ? `${Number(preset.min).toLocaleString('fr-MA')}+ DH`
                  : `${Number(preset.min).toLocaleString('fr-MA')}–${Number(preset.max).toLocaleString('fr-MA')}`
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
                  'flex w-full items-center justify-between gap-1.5 rounded-xl border px-3 text-start font-semibold leading-5 transition active:scale-[0.97]',
                  compact ? 'min-h-9 py-1.5 text-xs' : 'min-h-11 py-2 text-[13px]',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                  active
                    ? 'border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-fg)] shadow-glow'
                    : 'border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] hover:border-[var(--brand)]'
                )}
              >
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {active ? <SiteIcon name="check" size={compact ? 12 : 14} className="shrink-0" /> : null}
              </button>
            )
          })}
        </div>

        <div className={cn('rounded-2xl border border-[var(--border)] bg-[var(--bg)]/40', compact ? 'p-2.5' : 'p-3')}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fg-muted)]">
            {t('shop.customRange')}
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <label className="min-w-0 space-y-1 text-xs">
              <span className="block font-medium leading-4 text-[var(--fg-muted)]">{t('shop.min')}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={values.minPrice || ''}
                onChange={(e) => onChange({ ...values, minPrice: e.target.value || undefined })}
                placeholder="0"
                className={cn('w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 outline-none ring-brand', compact ? 'h-9 text-[13px]' : 'h-11 text-base sm:text-sm')}
              />
            </label>
            <span className={cn('text-sm leading-none text-[var(--fg-muted)]', compact ? 'mb-2' : 'mb-2.5')} aria-hidden>
              –
            </span>
            <label className="min-w-0 space-y-1 text-xs">
              <span className="block font-medium leading-4 text-[var(--fg-muted)]">{t('shop.max')}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={values.maxPrice || ''}
                onChange={(e) => onChange({ ...values, maxPrice: e.target.value || undefined })}
                placeholder={t('shop.any')}
                className={cn('w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 outline-none ring-brand', compact ? 'h-9 text-[13px]' : 'h-11 text-base sm:text-sm')}
              />
            </label>
          </div>
        </div>
      </FilterSection>
    </aside>
  )
}
