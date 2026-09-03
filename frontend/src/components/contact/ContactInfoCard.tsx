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
  value: string
  href?: string
  onClick?: () => void
  className?: string
}) {
  const inner = (
    <span className="relative flex items-start gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--bg-muted)] text-[var(--brand-text)]">
        {icon}
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fg-muted)]">
          {label}
        </span>
        <span className="mt-1.5 block text-sm font-semibold leading-snug text-[var(--fg)] sm:text-[15px]">
          {value}
        </span>
      </span>
    </span>
  )

  const styles = cn(
    'relative flex overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg)] p-5 shadow-soft transition duration-300',
    (href || onClick) &&
      'hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
    className
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(styles, 'w-full text-start')}>
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

  return (
    <div className={styles}>
      {inner}
    </div>
  )
}
