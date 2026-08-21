import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function ContactInfoCard({
  icon,
  label,
  value,
  href,
  className,
}: {
  icon: ReactNode
  label: string
  value: string
  href?: string
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
    'relative flex overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-soft transition duration-300',
    href &&
      'hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-soft-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
    className
  )

  const glow = (
    <span
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,color-mix(in_srgb,var(--bg-muted)_90%,transparent),transparent_55%)]"
      aria-hidden="true"
    />
  )

  if (href) {
    return (
      <a
        href={href}
        className={styles}
        target={href.startsWith('http') ? '_blank' : undefined}
        rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      >
        {glow}
        {inner}
      </a>
    )
  }

  return (
    <div className={styles}>
      {glow}
      {inner}
    </div>
  )
}
