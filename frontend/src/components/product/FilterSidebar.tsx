import type { ReactNode } from 'react'
import type { Brand, Category } from '@/types'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { categoryDisplayName } from '@/i18n'
import { childrenOf, mainCategories, mainOf } from '@/lib/categoryTree'

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
  compact,
  children,
}: {
  title: string
  /** Not shown any more (plain headings) */
  icon?: 'layers' | 'boxes' | 'tag' | 'package-check'
  compact: boolean
  children: ReactNode
}) {
  return (
    <section className={compact ? 'space-y-2' : 'space-y-2.5'}>
      <h3 className={cn('font-semibold text-[var(--fg)]', compact ? 'text-[13px]' : 'text-sm')}>{title}</h3>
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
  // The chosen category's main one (itself, or Components when RAM is chosen)
  const activeMain = mainOf(categories, categories.find((c) => c.slug === values.category))
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

      {!hideCategories ? (
        <FilterSection compact={compact} title={t('shop.category')} icon="layers">
          <div className="flex flex-wrap gap-2">
            <OptionChip
                compact={compact}
              active={!values.category}
              label={t('shop.allCategories')}
              onClick={() => onChange({ ...values, category: undefined })}
            />
            {mainCategories(categories).map((c) => (
              <OptionChip
                compact={compact}
                key={c._id}
                active={activeMain?._id === c._id}
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
          {activeMain && childrenOf(categories, activeMain._id).length ? (
            <div className="mt-2.5 flex flex-wrap gap-2 border-s-2 border-[var(--brand)]/40 ps-2.5">
              {childrenOf(categories, activeMain._id).map((c) => (
                <OptionChip
                  compact
                  key={c._id}
                  active={values.category === c.slug}
                  label={categoryDisplayName(locale, c.slug, c.name)}
                  onClick={() =>
                    onChange({ ...values, category: values.category === c.slug ? activeMain.slug : c.slug })
                  }
                />
              ))}
            </div>
          ) : null}
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

      </FilterSection>
    </aside>
  )
}
