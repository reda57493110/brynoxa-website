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
    <label className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] ps-2.5 pe-1 text-xs sm:h-10 sm:gap-2 sm:ps-3.5 sm:text-sm">
      <span className="hidden text-[var(--fg-muted)] sm:inline">{t('sort.label')}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 max-w-[9.5rem] rounded-full bg-transparent px-1 font-medium text-[var(--fg)] outline-none ring-brand sm:max-w-none sm:px-2"
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
