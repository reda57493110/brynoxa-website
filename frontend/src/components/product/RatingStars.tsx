import { SiteIcon } from '@/components/ui/SiteIcon'

export function RatingStars({
  rating,
  count,
  size = 'sm',
}: {
  rating: number
  count?: number
  size?: 'sm' | 'md'
}) {
  const px = size === 'sm' ? 13 : 15
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => {
          const filled = i + 1 <= Math.round(rating)
          return (
            <SiteIcon
              key={i}
              name="star"
              size={px}
              solid={filled}
              className={filled ? 'text-[var(--brand)]' : 'text-[var(--border)]'}
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
