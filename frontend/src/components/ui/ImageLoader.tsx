import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

/** Spinner centered over an image frame while the photo downloads. */
export function ImageSpinner({ size = 'lg', className }: { size?: 'md' | 'lg'; className?: string }) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 flex items-center justify-center', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-[var(--bg-elevated)]/80 shadow-soft backdrop-blur-sm dark:bg-black/40',
          size === 'lg' ? 'h-14 w-14' : 'h-10 w-10'
        )}
      >
        <Spinner size={size} />
      </span>
    </div>
  )
}
