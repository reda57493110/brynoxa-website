import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const t = useT()
  const sizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-[3px]' }
  return (
    <span
      className={cn(
        'inline-block animate-spin rounded-full border-[var(--border)] border-t-[var(--brand)]',
        sizes[size],
        className
      )}
      role="status"
      aria-label={t('ui.loadingStatus')}
    />
  )
}
