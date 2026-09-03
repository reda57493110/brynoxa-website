import { Spinner } from '@/components/ui/Spinner'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

export function PageLoader({
  label,
  compact = false,
  className,
}: {
  label?: string
  compact?: boolean
  className?: string
}) {
  const t = useT()
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center',
        compact ? 'py-8' : 'min-h-[50vh] py-16',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-14 w-14 items-center justify-center">
        <Spinner size="lg" className="absolute inset-0 h-14 w-14" />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-[var(--brand-text)] shadow-soft">
          <SiteIcon name="package" size={18} />
        </span>
      </span>
      <p className="text-sm font-medium text-[var(--fg-muted)]">{label ?? t('ui.loading')}</p>
    </div>
  )
}
