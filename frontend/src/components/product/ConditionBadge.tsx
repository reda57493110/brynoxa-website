import { useT } from '@/hooks/useT'
import { cn } from '@/lib/cn'
import { isPreOwned } from '@/lib/condition'
import type { ProductCondition } from '@/types'

const styles: Record<Exclude<ProductCondition, 'new'>, string> = {
  refurbished:
    'border-[color-mix(in_srgb,var(--brand)_45%,transparent)] bg-[color-mix(in_srgb,var(--brand)_16%,var(--bg-elevated))] text-[var(--brand-text)]',
  used: 'border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[color-mix(in_srgb,var(--warning)_16%,var(--bg-elevated))] text-[var(--warning)]',
}

/** "Refurbished" / "Used" pill. Renders nothing for new (or unknown) condition. */
export function ConditionBadge({
  condition,
  size = 'md',
  className,
}: {
  condition?: ProductCondition | null
  size?: 'sm' | 'md'
  className?: string
}) {
  const t = useT()
  if (!isPreOwned(condition)) return null
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border font-bold tracking-wide backdrop-blur-md',
        size === 'sm'
          ? 'px-2 py-0.5 text-[10px] sm:px-2.5 sm:py-1 sm:text-[11px]'
          : 'px-2.5 py-1 text-xs',
        styles[condition],
        className
      )}
    >
      {t(`condition.${condition}`)}
    </span>
  )
}
