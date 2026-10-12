import { cn } from '@/lib/cn'
import { ImageSpinner } from './ImageLoader'

/** Placeholder block with a sweeping shine; `spinner` adds the image loading indicator. */
export function Skeleton({
  className,
  spinner = false,
}: {
  className?: string
  /** true or a size: show the image loading indicator */
  spinner?: boolean | 'md' | 'lg'
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-[var(--bg-muted)] ring-1 ring-[var(--border)]', className)}>
      {spinner ? (
        <ImageSpinner size={spinner === 'lg' ? 'lg' : 'md'} />
      ) : (
        <div
          className="absolute inset-y-0 start-0 w-2/3 -translate-x-full bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--fg)_6%,transparent)] to-transparent motion-safe:animate-[image-shimmer_1.6s_ease-in-out_infinite] rtl:translate-x-full"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
