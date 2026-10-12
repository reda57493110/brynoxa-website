import { useState } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ProductSearch, Thumb } from '@/components/admin/PageHeaderProducts'
import { MAX_HOME_DEALS, useHomeDeals } from '@/hooks/useHomeDeals'
import { formatCurrency } from '@/lib/format'
import { toast } from '@/store/toastStore'
import type { Product } from '@/types'

const percentOff = (p: Product) =>
  p.compareAtPrice != null && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : null

/** Admin → Settings → Storefront: the products shown as deals at the top of the home page. */
export function HomeDealsSettings({ value }: { value?: string[] }) {
  const qc = useQueryClient()
  const ids = value ?? []
  const [adding, setAdding] = useState(false)
  const shown = useHomeDeals()

  const products = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['admin-product', id],
      queryFn: async () => (await adminApi.products.get(id)).data.data,
      retry: false,
    })),
  })

  const save = useMutation({
    mutationFn: (next: string[]) => adminApi.settings.update({ homeDeals: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['admin-settings'] })
      qc.invalidateQueries({ queryKey: ['home-deals'] })
      qc.invalidateQueries({ queryKey: ['home-deals-auto'] })
      toast.success('Home page deals updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const move = (from: number, to: number) => {
    const next = [...ids]
    const [id] = next.splice(from, 1)
    next.splice(to, 0, id)
    save.mutate(next)
  }

  return (
    <div className="space-y-3">
      {ids.length ? (
        <ol className="space-y-2">
          {ids.map((id, i) => {
            const q = products[i]
            const p = q?.data
            const off = p ? percentOff(p) : null
            return (
              <li key={id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-xs font-semibold tabular-nums">
                  {i + 1}
                </span>
                <Thumb product={p} />
                <div className="min-w-0 flex-1">
                  {q?.isPending ? (
                    <p className="text-sm text-[var(--fg-muted)]">Loading…</p>
                  ) : p ? (
                    <>
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                        {off ? (
                          <span className="text-[var(--fg-muted)] line-through">{formatCurrency(p.compareAtPrice!)}</span>
                        ) : null}
                        {off ? <Badge variant="brand">−{off}%</Badge> : <Badge variant="muted">No discount</Badge>}
                        {!p.isActive ? (
                          <Badge variant="danger">Hidden — skipped</Badge>
                        ) : p.stock <= 0 ? (
                          <Badge variant="danger">Sold out — skipped</Badge>
                        ) : (
                          <span className="text-[var(--fg-muted)]">{p.stock} in stock</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-[var(--fg-muted)]">Product was deleted — skipped</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0 || save.isPending} onClick={() => move(i, i - 1)}>
                    <SiteIcon name="arrow-up" size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Move down"
                    disabled={i === ids.length - 1 || save.isPending}
                    onClick={() => move(i, i + 1)}
                  >
                    <SiteIcon name="arrow-up" size={14} className="rotate-180" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label="Remove"
                    className="text-[var(--danger)]"
                    disabled={save.isPending}
                    onClick={() => save.mutate(ids.filter((x) => x !== id))}
                  >
                    <SiteIcon name="trash" size={14} />
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border)] p-3 text-sm text-[var(--fg-muted)]">
          <p className="font-medium text-[var(--fg)]">Automatic</p>
          <p className="mt-0.5">
            {shown.products.length
              ? `Showing ${shown.products.map((p) => p.name).join(', ')} — your featured products in stock, biggest discounts first.`
              : 'Your featured products in stock, biggest discounts first.'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={adding ? 'ghost' : 'outline'}
          disabled={!adding && ids.length >= MAX_HOME_DEALS}
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? 'Done' : (
            <>
              <SiteIcon name="plus" size={14} /> Add a deal
            </>
          )}
        </Button>
        {ids.length ? (
          <Button size="sm" variant="ghost" disabled={save.isPending} onClick={() => save.mutate([])}>
            Use automatic
          </Button>
        ) : null}
        <span className="text-xs text-[var(--fg-muted)]">
          {ids.length}/{MAX_HOME_DEALS} · Sold-out or hidden products are skipped automatically. Set a “compare at” price on a product to show its discount.
        </span>
        <a href="/" target="_blank" rel="noreferrer" className="ms-auto inline-flex items-center gap-1 text-sm text-[var(--brand-text)] hover:underline">
          View page <SiteIcon name="external" size={13} />
        </a>
      </div>

      {adding ? (
        <ProductSearch
          currentId=""
          chosenIds={ids}
          actionLabel="Add"
          saving={save.isPending || ids.length >= MAX_HOME_DEALS}
          onSelect={(id) => {
            const next = [...ids, id].slice(0, MAX_HOME_DEALS)
            save.mutate(next, { onSuccess: () => next.length >= MAX_HOME_DEALS && setAdding(false) })
          }}
        />
      ) : null}
    </div>
  )
}
