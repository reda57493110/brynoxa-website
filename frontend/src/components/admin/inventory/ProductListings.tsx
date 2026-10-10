import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/admin/customers/shared'
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
      toast.success('Listing created (hidden) — set its price and activate it')
      onDone()
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const missing = (['refurbished', 'used'] as const).filter((c) => !has(c))

  return (
    <Section title="Listings of this model">
      {detail.listings.length ? (
        <ul className="divide-y divide-[var(--border)]">
          {detail.listings.map((l) => {
            const current = l._id === detail.product._id
            return (
              <li key={l._id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ConditionBadge condition={l.condition} />
                    {!l.isActive ? <Badge variant="danger">Hidden</Badge> : null}
                    {current ? <Badge variant="muted">This listing</Badge> : null}
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">{l.name}</p>
                  <p className="truncate text-[11px] text-[var(--fg-muted)]">{l.sku}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <span className="text-right">
                    <span className={cn('font-semibold', l.stock <= 0 && 'text-[var(--danger)]')}>{l.stock}</span>
                    <span className="text-[var(--fg-muted)]"> sellable</span>
                    <br />
                    <span className="text-xs text-[var(--fg-muted)]">{formatCurrency(l.price)}</span>
                  </span>
                  {!current ? (
                    <Link
                      to={`/admin/inventory/products/${l._id}`}
                      className="inline-flex h-9 items-center rounded-full border border-[var(--border)] px-3 text-sm hover:border-[var(--brand)]"
                    >
                      Open
                    </Link>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">Only this listing exists.</p>
      )}

      {missing.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {missing.map((c) => (
            <Button
              key={c}
              size="sm"
              variant="outline"
              loading={create.isPending && create.variables === c}
              disabled={create.isPending}
              onClick={() => create.mutate(c)}
            >
              Create {c} listing
            </Button>
          ))}
        </div>
      ) : null}

      {created ? (
        <p className="mt-3 rounded-xl bg-[var(--bg-muted)] px-3 py-2 text-sm">
          New hidden listing created.{' '}
          <Link to={`/admin/products/${created.id}/edit`} className="font-medium text-[var(--brand-text)] hover:underline">
            Set price &amp; activate
          </Link>
        </p>
      ) : null}
    </Section>
  )
}
