import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { Product } from '@/types'
import { ProductCard } from './ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageLoader } from '@/components/ui/PageLoader'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/cn'
import { useT } from '@/hooks/useT'

function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-elevated)]">
      <Skeleton className="aspect-[4/3] w-full rounded-none border-0 ring-0" />
      <div className="space-y-2.5 p-3 sm:p-4">
        <Skeleton className="h-3 w-1/3 ring-0" />
        <Skeleton className="h-4 w-[80%] ring-0" />
        <Skeleton className="h-4 w-1/2 ring-0" />
        <Skeleton className="mt-1 h-9 w-full rounded-full ring-0" />
      </div>
    </div>
  )
}

function ProductGridLoading({
  className,
  count = 8,
}: {
  className?: string
  count?: number
}) {
  const t = useT()
  return (
    <div className="relative min-h-[18rem]" role="status" aria-live="polite" aria-busy="true">
      <div className={className} aria-hidden="true">
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_55%,transparent)] backdrop-blur-[1px]">
        <PageLoader compact label={t('ui.loadingProducts')} className="min-h-0 rounded-2xl bg-[var(--bg-elevated)]/90 px-5 shadow-soft" />
      </div>
    </div>
  )
}

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
  const reduceMotion = useReducedMotion()
  const gridClass = cn(
    'grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    className
  )

  // Always show in-place product loader while fetching — even with previous cards.
  if (loading) {
    return <ProductGridLoading className={gridClass} />
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
      {products.map((p, i) => (
        <motion.div
          key={p._id}
          className="h-full"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.35,
            delay: Math.min(i, 11) * 0.04,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          <ProductCard product={p} />
        </motion.div>
      ))}
    </div>
  )
}
