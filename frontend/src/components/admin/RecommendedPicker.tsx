import { useDeferredValue, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { Input } from '@/components/ui/Input'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { formatCurrency } from '@/lib/format'
import { toPicked, type PickedProduct } from '@/lib/recommended'

const MAX_PICKS = 12

const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] text-[var(--fg-muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] disabled:opacity-40'

/** Admin: hand-pick the "Complete your setup" products shown on a product page. */
export function RecommendedPicker({
  value,
  onChange,
  only,
  onOnlyChange,
  excludeId,
}: {
  value: PickedProduct[]
  onChange: (next: PickedProduct[]) => void
  only: boolean
  onOnlyChange: (next: boolean) => void
  excludeId?: string
}) {
  const [query, setQuery] = useState('')
  const q = useDeferredValue(query.trim())
  const full = value.length >= MAX_PICKS

  const results = useQuery({
    queryKey: ['admin-products', 'recommend-search', q],
    queryFn: async () => (await adminApi.products.list({ q, limit: 8 })).data.data,
    enabled: q.length >= 2,
  })
  const pickedIds = new Set(value.map((p) => p._id))
  const options = (results.data || []).filter((p) => p._id !== excludeId && !pickedIds.has(p._id))

  const move = (index: number, delta: -1 | 1) => {
    const next = [...value]
    const [item] = next.splice(index, 1)
    next.splice(index + delta, 0, item)
    onChange(next)
  }

  return (
    <div className="sm:col-span-2 space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-muted)]/30 p-4">
      <div>
        <p className="text-sm font-medium">Complete your setup — your picks</p>
        <p className="mt-0.5 text-xs text-[var(--fg-muted)]">
          Shown first on this product's page, in this order. Automatic suggestions fill the remaining spots
          (8 in total) unless you turn them off below. Hidden or out-of-category products are skipped.
        </p>
      </div>

      {value.length ? (
        <ol className="space-y-2">
          {value.map((p, i) => (
            <li
              key={p._id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-2"
            >
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-[var(--fg-muted)]">{i + 1}</span>
              <SafeImage src={p.image} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block truncate text-xs text-[var(--fg-muted)]">
                  {p.sku} · {formatCurrency(p.price)}
                  {!p.isActive ? ' · hidden (not shown)' : p.stock <= 0 ? ' · out of stock' : ''}
                </span>
              </span>
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                <SiteIcon name="chevron" size={15} />
              </button>
              <button
                type="button"
                className={iconBtn}
                disabled={i === value.length - 1}
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                <SiteIcon name="chevron-down" size={15} />
              </button>
              <button
                type="button"
                className={iconBtn}
                onClick={() => onChange(value.filter((x) => x._id !== p._id))}
                aria-label={`Remove ${p.name}`}
              >
                <SiteIcon name="close" size={15} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-[var(--fg-muted)]">No picks yet — suggestions are chosen automatically.</p>
      )}

      <div>
        <Input
          label={full ? `Maximum ${MAX_PICKS} picks reached` : 'Add a product'}
          placeholder="Search by name or SKU…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={full}
        />
        {q.length >= 2 && !full ? (
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto">
            {results.isLoading ? (
              <li className="px-2 py-1.5 text-xs text-[var(--fg-muted)]">Searching…</li>
            ) : options.length ? (
              options.map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange([...value, toPicked(p)])
                      setQuery('')
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-start transition hover:bg-[var(--bg-muted)]"
                  >
                    <SafeImage src={toPicked(p).image} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{p.name}</span>
                      <span className="block truncate text-xs text-[var(--fg-muted)]">
                        {p.sku} · {formatCurrency(p.price)}
                      </span>
                    </span>
                    <SiteIcon name="plus" size={16} className="shrink-0 text-[var(--brand-text)]" />
                  </button>
                </li>
              ))
            ) : (
              <li className="px-2 py-1.5 text-xs text-[var(--fg-muted)]">No matching products.</li>
            )}
          </ul>
        ) : null}
      </div>

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1" checked={only} onChange={(e) => onOnlyChange(e.target.checked)} />
        <span>
          <span className="block text-sm font-medium">Show only my picks</span>
          <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
            No automatic suggestions for this product. With no picks, the section is hidden.
          </span>
        </span>
      </label>
    </div>
  )
}
