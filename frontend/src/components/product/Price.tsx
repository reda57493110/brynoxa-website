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
    <div className={cn('flex items-baseline gap-2', className)}>
      <span className="font-display text-lg font-semibold text-[var(--fg)]">
        {formatCurrency(price)}
      </span>
      {onSale ? (
        <span className="text-sm text-[var(--fg-muted)] line-through">
          {formatCurrency(compareAt)}
        </span>
      ) : null}
    </div>
  )
}
