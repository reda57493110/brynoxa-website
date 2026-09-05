import { useT } from '@/hooks/useT'

export function SpecTable({ specs }: { specs: Record<string, string> }) {
  const t = useT()
  const entries = Object.entries(specs || {})
  if (!entries.length) {
    return (
      <div className="rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-5 sm:px-5">
        <p className="text-sm text-[var(--fg-muted)]">{t('productPage.noSpecs')}</p>
      </div>
    )
  }

  return (
    <dl className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)]">
      {entries.map(([key, value], i) => (
        <div
          key={key}
          className={
            i % 2 === 0
              ? 'grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 px-4 py-3.5 sm:gap-4 sm:px-5'
              : 'grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 bg-[color-mix(in_srgb,var(--bg-muted)_55%,var(--bg-elevated))] px-4 py-3.5 sm:gap-4 sm:px-5'
          }
        >
          <dt className="text-sm font-medium text-[var(--fg-muted)]">{key}</dt>
          <dd className="text-sm font-medium leading-relaxed text-[var(--fg)]">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
