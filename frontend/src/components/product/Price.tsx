import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'

export function Price({
  price,
  compareAt,
  className,
}: {
  price: number
  compareAt?: number
  className?: string
}) {
  const onSale = compareAt != null && compareAt > price
  return (
    <div className={cn('flex flex-wrap items-baseline gap-2', className)}>
      <span className="font-display text-lg font-semibold text-[var(--fg)]">
        {formatCurrency(price)}
      </span>
      {onSale ? (
        <>
          <span className="text-sm text-[var(--fg-muted)] line-through decoration-[var(--fg-muted)]">
            {formatCurrency(compareAt)}
          </span>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-text)]">
            −{Math.round((1 - price / compareAt) * 100)}%
          </span>
        </>
      ) : null}
    </div>
  )
}
