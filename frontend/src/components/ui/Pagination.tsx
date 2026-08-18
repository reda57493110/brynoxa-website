import { SiteIcon } from '@/components/ui/SiteIcon'

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number
  pages: number
  onChange: (page: number) => void
}) {
  if (pages <= 1) return null

  const btn =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--fg)] transition hover:border-[var(--brand)] hover:text-[var(--brand-text)] disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]'

  return (
    <nav className="flex items-center justify-center gap-3 pt-10" aria-label="Pagination">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <SiteIcon name="chevron-left" size={16} />
      </button>
      <p className="min-w-[7rem] text-center text-sm text-[var(--fg-muted)]">
        Page <span className="font-semibold text-[var(--fg)]">{page}</span> of {pages}
      </p>
      <button type="button" className={btn} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
        <SiteIcon name="chevron-right" size={16} />
      </button>
    </nav>
  )
}
