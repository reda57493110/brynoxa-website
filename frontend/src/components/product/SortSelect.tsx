import { SORT_OPTIONS } from '@/lib/constants'

export function SortSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] pl-3.5 pr-1 text-sm">
      <span className="text-[var(--fg-muted)]">Sort</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-full bg-transparent px-2 font-medium text-[var(--fg)] outline-none ring-brand"
        aria-label="Sort products"
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
