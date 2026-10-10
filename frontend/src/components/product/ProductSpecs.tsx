import { useState } from 'react'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/localeStore'
import { normalizeSpecs, groupSpecs } from '@/lib/specs'
import { cn } from '@/lib/cn'

const KEY_LIMIT = 6

/**
 * Specifications beside the product photos: the key specs as tiles, and every spec grouped by
 * section (Performance, Display…) on demand. Only specs with a value are shown.
 */
export function ProductSpecs({ specs, template }: { specs?: Record<string, string> | null; template: string }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const [all, setAll] = useState(false)
  const sections = groupSpecs(normalizeSpecs(specs, template), template, locale)
  const rows = sections.flatMap((s) => s.rows)
  if (!rows.length) return null

  // Key specs first, topped up with the next ones so the tiles are never empty
  const important = rows.filter((r) => r.important)
  const keyRows = [...important, ...rows.filter((r) => !r.important)].slice(0, KEY_LIMIT)
  const canExpand = rows.length > keyRows.length

  return (
    <section aria-label={t('productPage.specifications')} className="mt-4">
      {all ? (
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3 sm:p-4">
          {sections.map((s) => (
            <div key={s.id}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--fg-muted)]">{s.title}</h3>
              <dl className="mt-1 divide-y divide-[var(--border)]">
                {s.rows.map((r) => (
                  <div key={r.key} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-1.5 text-[13px]">
                    <dt className="text-[var(--fg-muted)]">{r.label}</dt>
                    <dd className="min-w-0 font-medium break-words text-[var(--fg)]">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <dl className="grid grid-cols-2 gap-2">
          {keyRows.map((r) => (
            <div key={r.key} className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2">
              <dt className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--fg-muted)]">{r.label}</dt>
              <dd className="mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug text-[var(--fg)]">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {canExpand ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          aria-expanded={all}
          className={cn('mt-2 text-sm font-medium text-[var(--brand-text)] hover:underline')}
        >
          {all ? t('productPage.keySpecs') : t('productPage.allSpecs', { count: rows.length })}
        </button>
      ) : null}
    </section>
  )
}
