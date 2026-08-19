import { SORT_OPTIONS } from '@/lib/constants'
import { useT } from '@/hooks/useT'
import type { MessageKey } from '@/i18n'

export function SortSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const t = useT()
  return (
    <label className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] pl-3.5 pr-1 text-sm">
      <span className="text-[var(--fg-muted)]">{t('sort.label')}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-full bg-transparent px-2 font-medium text-[var(--fg)] outline-none ring-brand"
        aria-label={t('sort.aria')}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {t(`sort.${opt.value}` as MessageKey)}
          </option>
        ))}
      </select>
    </label>
  )
}
