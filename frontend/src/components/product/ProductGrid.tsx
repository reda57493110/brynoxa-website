import { useNavigate } from 'react-router-dom'
import type { Product } from '@/types'
import { ProductCard } from './ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

export function ProductGrid({
  products,
  loading,
  className,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  emptyActionTo,
  onEmptyAction,
}: {
  products?: Product[]
  loading?: boolean
  className?: string
  emptyTitle?: string
  emptyDescription?: string
  emptyActionLabel?: string
  emptyActionTo?: string
  onEmptyAction?: () => void
}) {
  const t = useT()
  const navigate = useNavigate()
  const gridClass = cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', className)

  if (loading) {
    return (
      <div className={gridClass}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-[var(--radius-card)]" />
        ))}
      </div>
    )
  }

  if (!products?.length) {
    return (
      <EmptyState
        title={emptyTitle ?? t('shop.gridEmpty')}
        description={emptyDescription ?? t('shop.gridEmptyBody')}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction ?? (emptyActionTo ? () => navigate(emptyActionTo) : undefined)}
      />
    )
  }

  return (
    <div className={gridClass}>
      {products.map((p) => (
        <ProductCard key={p._id} product={p} />
      ))}
    </div>
  )
}
