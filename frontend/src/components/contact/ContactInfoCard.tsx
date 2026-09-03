import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function ContactInfoCard({
  icon,
  label,
  value,
  href,
  onClick,
  className,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  href?: string
  onClick?: () => void
  className?: string
}) {
  const inner = (
    <span className="relative flex h-full items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-muted)] text-[var(--brand-text)] sm:h-11 sm:w-11 sm:rounded-2xl">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fg-muted)]">
          {label}
        </span>
        <span className="mt-1 block break-words text-sm font-semibold leading-snug text-[var(--fg)]">
          {value}
        </span>
      </span>
    </span>
  )

  const styles = cn(
    'relative flex h-full w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3.5 text-start shadow-soft transition duration-200 sm:rounded-[1.25rem] sm:p-4',
    (href || onClick) &&
      'hover:border-[var(--brand)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
    className
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={styles}>
        {inner}
      </button>
    )
  }

  if (href) {
    return (
      <a
        href={href}
        className={styles}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {inner}
      </a>
    )
  }

  return <div className={styles}>{inner}</div>
}
