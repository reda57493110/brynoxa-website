import { SiteIcon, type SiteIconName } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export function EmptyState({
  title,
  description,
  icon = 'inbox',
  actionLabel,
  onAction,
  className,
}: {
  title: string
  description?: string
  icon?: SiteIconName
  actionLabel?: string
  onAction?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--bg-elevated)] px-6 py-16 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--brand-text)]">
        <SiteIcon name={icon} size={22} />
      </div>
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description ? <p className="mt-2 max-w-sm text-sm text-[var(--fg-muted)]">{description}</p> : null}
      {actionLabel && onAction ? (
        <Button className="mt-6 rounded-full" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
