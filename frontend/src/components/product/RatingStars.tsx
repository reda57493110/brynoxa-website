import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'

export function RatingStars({
  rating,
  count,
  size = 'sm',
}: {
  rating: number
  count?: number
  size?: 'sm' | 'md'
}) {
  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i + 1 <= Math.round(rating)
          return (
            <Star
              key={i}
              className={cn(
                starSize,
                filled ? 'fill-[var(--brand)] text-[var(--brand)]' : 'text-[var(--border)]'
              )}
            />
          )
        })}
      </div>
      {count != null ? (
        <span className="text-xs text-[var(--fg-muted)]">
          {rating.toFixed(1)} ({count})
        </span>
      ) : null}
    </div>
  )
}
