import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import type { Product } from '@/types'
import { ProductCard } from './ProductCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageLoader } from '@/components/ui/PageLoader'
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
  const reduceMotion = useReducedMotion()
  const gridClass = cn(
    'grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    className
  )

  if (loading) {
    return (
      <div className="relative">
        <div className={gridClass} aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-[var(--radius-card)]" />
          ))}
        </div>
        <div className="absolute inset-0 flex items-start justify-center bg-[color-mix(in_srgb,var(--bg)_55%,transparent)] pt-16 backdrop-blur-[1px]">
          <PageLoader compact label={t('ui.loadingProducts')} className="min-h-0 rounded-[1.25rem] border border-[var(--border)] bg-[var(--bg-elevated)]/95 px-6 py-5 shadow-soft" />
        </div>
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
      {products.map((p, i) => (
        <motion.div
          key={p._id}
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
