import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'muted'

const styles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-muted)] text-[var(--fg)]',
  brand: 'bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] text-[var(--brand-text)]',
  success: 'bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-[var(--success)]',
  warning: 'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-[var(--warning)]',
  danger: 'bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]',
  muted: 'bg-[var(--bg-muted)] text-[var(--fg-muted)]',
}

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide capitalize',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
