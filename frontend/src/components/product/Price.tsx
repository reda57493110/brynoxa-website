import { formatCurrency } from '@/lib/format'
import { cn } from '@/lib/cn'

export function Price({
  price,
  compareAt,
  className,
  showDiscountBadge = true,
}: {
  price: number
  compareAt?: number
  className?: string
  showDiscountBadge?: boolean
}) {
  const onSale = compareAt != null && compareAt > price
  return (
    <div className={cn('flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 sm:gap-2', className)}>
      <span className="font-display text-base font-semibold tracking-tight text-[var(--fg)] sm:text-lg">
        {formatCurrency(price)}
      </span>
      {onSale ? (
        <>
          <span className="text-xs font-medium text-[var(--fg-muted)] line-through decoration-[var(--fg-muted)] sm:text-sm">
            {formatCurrency(compareAt)}
          </span>
          {showDiscountBadge ? (
            <span className="hidden rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-[11px] font-bold text-[var(--brand-text)] sm:inline-flex">
              −{Math.round((1 - price / compareAt) * 100)}%
            </span>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
