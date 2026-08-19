import { useT } from '@/hooks/useT'

export function SpecTable({ specs }: { specs: Record<string, string> }) {
  const t = useT()
  const entries = Object.entries(specs || {})
  if (!entries.length) {
    return <p className="text-sm text-[var(--fg-muted)]">{t('productPage.noSpecs')}</p>
  }

  return (
    <div className="overflow-hidden rounded-[1.35rem] border border-[var(--border)]">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, value], i) => (
            <tr
              key={key}
              className={i % 2 === 0 ? 'bg-[var(--bg-elevated)]' : 'bg-[var(--bg-muted)]'}
            >
              <th className="w-2/5 px-4 py-3 text-left font-medium text-[var(--fg-muted)]">
                {key}
              </th>
              <td className="px-4 py-3 text-[var(--fg)]">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
