import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cardClass } from '@/components/admin/customers/shared'
import { formatCurrency } from '@/lib/format'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { ProductInventoryDetail } from '@/types'
import { ConditionBadge } from './ProductBadges'

/** New / Refurbished / Used versions of the same model. */
export function ProductListings({ detail, onDone }: { detail: ProductInventoryDetail; onDone: () => void }) {
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)
  const has = (c: 'refurbished' | 'used') =>
    detail.listings.some((l) => (l.condition || 'new') === c) || detail.product.condition === c

  const create = useMutation({
    mutationFn: (condition: 'refurbished' | 'used') => inventoryApi.createListing(detail.product._id, { condition }),
    onSuccess: (res) => {
      const p = res.data.data
      setCreated({ id: p._id, name: p.name })
      toast.success('Listing created (inactive) — set its price and activate it')
      onDone()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const missing = (['refurbished', 'used'] as const).filter((c) => !has(c))
  const others = detail.listings.filter((l) => l._id !== detail.product._id)

  return (
    <section className={cn(cardClass, 'min-w-0 p-3 sm:p-4')}>
      <h2 className="font-display text-sm font-semibold sm:text-base">Other conditions</h2>
      {others.length ? (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {others.map((l) => (
            <li key={l._id}>
              <Link
                to={`/admin/inventory/products/${l._id}`}
                className="flex min-w-0 items-center gap-2 py-2 hover:text-[var(--brand-text)]"
              >
                <ConditionBadge condition={l.condition} />
                {!l.isActive ? <Badge variant="muted">Inactive</Badge> : null}
                <span className="min-w-0 flex-1 truncate text-xs text-[var(--fg-muted)]">{l.sku}</span>
                <span className="shrink-0 text-end text-sm tabular-nums">
                  <span className={cn('font-semibold', l.stock <= 0 && 'text-[var(--danger)]')}>{l.stock}</span>
                  <span className="text-[var(--fg-muted)]"> · {formatCurrency(l.price)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-[var(--fg-muted)]">No used or refurbished version yet.</p>
      )}

      {missing.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {missing.map((c) => (
            <Button
              key={c}
              size="sm"
              variant="outline"
              loading={create.isPending && create.variables === c}
              disabled={create.isPending}
              onClick={() => create.mutate(c)}
            >
              + {c === 'used' ? 'Used' : 'Refurbished'}
            </Button>
          ))}
        </div>
      ) : null}

      {created ? (
        <p className="mt-2 text-xs">
          Created (inactive).{' '}
          <Link to={`/admin/products/${created.id}/edit`} className="font-medium text-[var(--brand-text)] hover:underline">
            Set price &amp; activate
          </Link>
        </p>
      ) : null}
    </section>
  )
}
