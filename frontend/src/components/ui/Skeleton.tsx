import { cn } from '@/lib/cn'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-xl bg-[var(--bg-muted)] ring-1 ring-[var(--border)]',
        className
      )}
    />
  )
}
