import type { ReactNode } from 'react'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'

export function SocialCard({
  name,
  handle,
  href,
  icon,
  className,
}: {
  name: string
  handle: string
  href: string
  icon: ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name} — opens in a new tab`}
      className={cn(
        'group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 shadow-soft transition duration-300',
        'hover:-translate-y-1 hover:border-[var(--brand)] hover:shadow-soft-lg',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
        className
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--bg-muted)] text-[var(--fg)] transition duration-300 group-hover:bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] group-hover:text-[var(--brand)]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold">{name}</span>
        <span className="block truncate text-sm text-[var(--fg-muted)]">{handle}</span>
      </span>
      <SiteIcon
        name="external"
        size={15}
        className="shrink-0 text-[var(--fg-muted)] opacity-0 transition duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-[var(--brand)]"
      />
    </a>
  )
}
