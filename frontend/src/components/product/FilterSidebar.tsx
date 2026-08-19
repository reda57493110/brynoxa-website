import type { Brand, Category } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

export interface FilterValues {
  category?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
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
  const hasActive = Boolean(values.category || values.brand || values.minPrice || values.maxPrice)

  const optionClass = (active: boolean) =>
    cn(
      'rounded-xl px-3 py-2 text-left text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
      active
        ? 'bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] font-medium text-[var(--brand-text)]'
        : 'hover:bg-[var(--bg-muted)]'
    )

  return (
    <aside
      className={
        plain
          ? 'space-y-6'
          : 'space-y-6 rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft'
      }
    >
      {!plain ? (
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">{t('shop.filters')}</h2>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={!hasActive}>
            {t('ui.clear')}
          </Button>
        </div>
      ) : hasActive ? (
        <Button variant="ghost" size="sm" className="-mt-1 self-start" onClick={onClear}>
          {t('ui.clearAll')}
        </Button>
      ) : null}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {t('shop.category')}
        </p>
        <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
          <button
            type="button"
            onClick={() => onChange({ ...values, category: undefined })}
            className={optionClass(!values.category)}
          >
            {t('shop.allCategories')}
          </button>
          {categories.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() =>
                onChange({ ...values, category: values.category === c.slug ? undefined : c.slug })
              }
              className={optionClass(values.category === c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {t('shop.brand')}
        </p>
        <div className="flex max-h-52 flex-col gap-0.5 overflow-y-auto">
          {brands.map((b) => (
            <button
              key={b._id}
              type="button"
              onClick={() =>
                onChange({ ...values, brand: values.brand === b.slug ? undefined : b.slug })
              }
              className={optionClass(values.brand === b.slug)}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {t('shop.priceDh')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label={t('shop.min')}
            type="number"
            min={0}
            value={values.minPrice || ''}
            onChange={(e) => onChange({ ...values, minPrice: e.target.value || undefined })}
            placeholder="0"
            className="h-10"
          />
          <Input
            label={t('shop.max')}
            type="number"
            min={0}
            value={values.maxPrice || ''}
            onChange={(e) => onChange({ ...values, maxPrice: e.target.value || undefined })}
            placeholder={t('shop.any')}
            className="h-10"
          />
        </div>
      </div>

      <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
        {t('shop.filterNote')}
      </p>
    </aside>
  )
}
