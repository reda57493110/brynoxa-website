import type { Brand, Category } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

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
}: {
  categories: Category[]
  brands: Brand[]
  values: FilterValues
  onChange: (next: FilterValues) => void
  onClear: () => void
}) {
  return (
    <aside className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Filters</h3>
        <Button variant="ghost" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Category
        </p>
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {categories.map((c) => (
            <button
              key={c._id}
              type="button"
              onClick={() =>
                onChange({ ...values, category: values.category === c.slug ? undefined : c.slug })
              }
              className={`rounded-xl px-3 py-2 text-left text-sm transition ${
                values.category === c.slug
                  ? 'bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand)]'
                  : 'hover:bg-[var(--bg-muted)]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Brand
        </p>
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
          {brands.map((b) => (
            <button
              key={b._id}
              type="button"
              onClick={() =>
                onChange({ ...values, brand: values.brand === b.slug ? undefined : b.slug })
              }
              className={`rounded-xl px-3 py-2 text-left text-sm transition ${
                values.brand === b.slug
                  ? 'bg-[color-mix(in_srgb,var(--brand)_15%,transparent)] text-[var(--brand)]'
                  : 'hover:bg-[var(--bg-muted)]'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Min"
          type="number"
          min={0}
          value={values.minPrice || ''}
          onChange={(e) => onChange({ ...values, minPrice: e.target.value || undefined })}
          placeholder="0"
        />
        <Input
          label="Max"
          type="number"
          min={0}
          value={values.maxPrice || ''}
          onChange={(e) => onChange({ ...values, maxPrice: e.target.value || undefined })}
          placeholder="Any"
        />
      </div>
    </aside>
  )
}
