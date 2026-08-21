import { useT } from '@/hooks/useT'

export function SpecTable({ specs }: { specs: Record<string, string> }) {
  const t = useT()
  const entries = Object.entries(specs || {})
  if (!entries.length) {
    return <p className="text-sm text-[var(--fg-muted)]">{t('productPage.noSpecs')}</p>
  }

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)]">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, value], i) => (
            <tr
              key={key}
              className={
                i % 2 === 0
                  ? 'bg-[var(--bg-elevated)]'
                  : 'bg-[color-mix(in_srgb,var(--bg-muted)_55%,var(--bg-elevated))]'
              }
            >
              <th className="w-[42%] px-4 py-3.5 text-start align-top font-medium text-[var(--fg-muted)]">
                {key}
              </th>
              <td className="px-4 py-3.5 align-top font-medium leading-relaxed text-[var(--fg)]">
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
