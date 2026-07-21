import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type BadgeVariant = 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'muted'

const styles: Record<BadgeVariant, string> = {
  default: 'bg-[var(--bg-muted)] text-[var(--fg)]',
  brand: 'bg-[color-mix(in_srgb,var(--brand)_18%,transparent)] text-[var(--brand)]',
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
        'inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold tracking-wide',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
