import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

export function StockBadge({
  stock,
  threshold = 5,
  compact = false,
}: {
  stock: number
  threshold?: number
  compact?: boolean
}) {
  const t = useT()

  const base =
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide backdrop-blur-md sm:px-2.5 sm:py-1 sm:text-[11px]'

  if (stock <= 0) {
    return (
      <span
        className={cn(
          base,
          'border-[color-mix(in_srgb,var(--danger)_45%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_18%,var(--bg-elevated))] text-[var(--danger)]'
        )}
      >
        {t('stock.outOfStock')}
      </span>
    )
  }

  if (stock <= threshold) {
    return (
      <span
        className={cn(
          base,
          'border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] bg-[color-mix(in_srgb,var(--warning)_14%,var(--bg-elevated))] text-[var(--warning)]'
        )}
      >
        {t('stock.onlyLeft', { count: stock })}
      </span>
    )
  }

  if (compact) return null

  return (
    <span
      className={cn(
        base,
        'border-[var(--border)] bg-[var(--bg-elevated)]/90 text-[var(--fg-muted)]'
      )}
    >
      {t('stock.inStock')}
    </span>
  )
}
