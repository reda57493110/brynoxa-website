import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Standard admin card: title, short description, optional header actions, body and footer. */
export function Panel({
  title,
  description,
  actions,
  footer,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('min-w-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]', className)}>
      <header className="flex min-w-0 flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </header>
      <div className="min-w-0 space-y-4 p-4 sm:p-5">{children}</div>
      {footer}
    </section>
  )
}
