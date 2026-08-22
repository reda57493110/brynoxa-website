import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import { useAdminStats } from '@/hooks/useAdminStats'
import type { Category, Product } from '@/types'

type StockFilter = 'all' | 'low' | 'out' | 'ok'
type Draft = { stock: number; threshold: number }

function primaryImage(p: Product) {
  return (
    p.images?.find((i) => i.isPrimary)?.url ||
    p.images?.[0]?.url ||
    ''
  )
}

function stockStatus(stock: number, threshold: number) {
  if (stock <= 0) return { label: 'Out of stock', variant: 'danger' as const }
  if (stock <= threshold) return { label: 'Low', variant: 'warning' as const }
  return { label: 'In stock', variant: 'success' as const }
}

export function Inventory() {
  const qc = useQueryClient()
  const stats = useAdminStats()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [filter, setFilter] = useState<StockFilter>('all')
  const [edits, setEdits] = useState<Record<string, Draft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const cats = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data,
  })

  const products = useQuery({
    queryKey: ['admin-inventory', { q, page, category }],
    queryFn: async () => {
      const res = await adminApi.products.list({
        page,
        limit: 20,
        q: q || undefined,
        category: category || undefined,
        admin: true,
      })
      return { items: res.data.data, meta: res.data.meta }
    },
  })

  const save = useMutation({
    mutationFn: ({
      id,
      stock,
      lowStockThreshold,
    }: {
      id: string
      stock: number
      lowStockThreshold: number
    }) => adminApi.products.inventory(id, stock, lowStockThreshold),
    onMutate: (vars) => setSavingId(vars.id),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      setEdits((prev) => {
        const next = { ...prev }
        delete next[vars.id]
        return next
      })
      toast.success('Stock updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
    onSettled: () => setSavingId(null),
  })

  const saveAll = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(edits)
      for (const [id, draft] of entries) {
        await adminApi.products.inventory(id, draft.stock, draft.threshold)
      }
      return entries.length
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      setEdits({})
      toast.success(`Saved ${count} product${count === 1 ? '' : 's'}`)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const list = products.data?.items ?? []

  const summary = useMemo(() => {
    const all = list
    const units = all.reduce((sum, p) => sum + p.stock, 0)
    const low = all.filter((p) => p.stock > 0 && p.stock <= p.lowStockThreshold).length
    const out = all.filter((p) => p.stock <= 0).length
    return {
      skus: products.data?.meta?.total ?? all.length,
      units,
      low: stats.data?.lowStock ?? low,
      out,
    }
  }, [list, products.data?.meta?.total, stats.data?.lowStock])

  const rows = useMemo(() => {
    return list
      .filter((p) => {
        const stock = edits[p._id]?.stock ?? p.stock
        const threshold = edits[p._id]?.threshold ?? p.lowStockThreshold
        if (filter === 'out') return stock <= 0
        if (filter === 'low') return stock > 0 && stock <= threshold
        if (filter === 'ok') return stock > threshold
        return true
      })
      .sort((a, b) => {
        const sa = edits[a._id]?.stock ?? a.stock
        const sb = edits[b._id]?.stock ?? b.stock
        const ta = edits[a._id]?.threshold ?? a.lowStockThreshold
        const tb = edits[b._id]?.threshold ?? b.lowStockThreshold
        const rank = (s: number, t: number) => (s <= 0 ? 0 : s <= t ? 1 : 2)
        const d = rank(sa, ta) - rank(sb, tb)
        return d !== 0 ? d : sa - sb
      })
  }, [list, filter, edits])

  const dirtyCount = Object.keys(edits).length

  const setDraft = (p: Product, patch: Partial<Draft>) => {
    setEdits((prev) => {
      const current = prev[p._id] ?? { stock: p.stock, threshold: p.lowStockThreshold }
      const next = { ...current, ...patch }
      if (next.stock === p.stock && next.threshold === p.lowStockThreshold) {
        const copy = { ...prev }
        delete copy[p._id]
        return copy
      }
      return { ...prev, [p._id]: next }
    })
  }

  const bump = (p: Product, delta: number) => {
    const current = edits[p._id]?.stock ?? p.stock
    setDraft(p, { stock: Math.max(0, current + delta) })
  }

  const filters: { id: StockFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'low', label: 'Low stock' },
    { id: 'out', label: 'Out of stock' },
    { id: 'ok', label: 'Healthy' },
  ]

  return (
    <div className={cn('min-w-0 space-y-4 sm:space-y-6', dirtyCount > 0 && 'pb-24 sm:pb-0')}>
      <AdminHeader
        title="Inventory"
        description="Adjust stock and low-stock alerts. Critical items sort to the top."
        actions={
          dirtyCount > 0 ? (
            <Button
              className="hidden w-full sm:inline-flex sm:w-auto"
              loading={saveAll.isPending}
              onClick={() => saveAll.mutate()}
            >
              Save all ({dirtyCount})
            </Button>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'SKUs', value: String(summary.skus), hint: 'In this view / catalog' },
          { label: 'Units on page', value: String(summary.units), hint: 'Sum of stock shown' },
          { label: 'Low stock', value: String(summary.low), hint: 'At or below threshold' },
          { label: 'Out of stock', value: String(summary.out), hint: 'On this page' },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4"
          >
            <p className="text-sm text-[var(--fg-muted)]">{card.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{card.value}</p>
            <p className="mt-1 text-xs text-[var(--fg-muted)]">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="min-w-0 flex-1 sm:min-w-[14rem]">
          <Input
            placeholder="Search name or SKU"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setPage(1)
          }}
          className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm sm:w-auto"
        >
          <option value="">All categories</option>
          {(cats.data as Category[] | undefined)?.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'h-11 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap',
                filter === f.id
                  ? 'border-transparent bg-[color-mix(in_srgb,var(--brand)_16%,transparent)] text-[var(--brand-text)]'
                  : 'border-[var(--border)]'
              )}
            >
              {f.label}
            </button>
          ))}
          {dirtyCount > 0 ? <Badge variant="warning">{dirtyCount} unsaved</Badge> : null}
        </div>
      </div>

      {products.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => {
            const draft = edits[p._id]
            const stock = draft?.stock ?? p.stock
            const threshold = draft?.threshold ?? p.lowStockThreshold
            const changed = Boolean(draft)
            const status = stockStatus(stock, threshold)
            const img = primaryImage(p)
            const cat = typeof p.category === 'object' ? p.category.name : ''

            return (
              <div
                key={p._id}
                className={cn(
                  'min-w-0 overflow-hidden rounded-xl border bg-[var(--bg-elevated)] p-3 transition sm:rounded-2xl sm:p-4',
                  status.variant === 'danger'
                    ? 'border-[color-mix(in_srgb,var(--danger)_45%,var(--border))]'
                    : status.variant === 'warning'
                      ? 'border-[color-mix(in_srgb,var(--warning)_45%,var(--border))]'
                      : 'border-[var(--border)]',
                  changed && 'ring-1 ring-[var(--brand)]'
                )}
              >
                <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)] sm:h-14 sm:w-14 sm:rounded-xl">
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--fg-muted)]">
                          <SiteIcon name="package" size={18} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <Link
                        to={`/admin/products/${p._id}/edit`}
                        className="block truncate text-sm font-medium hover:text-[var(--brand-text)]"
                      >
                        {p.name}
                      </Link>
                      <p className="truncate text-[11px] text-[var(--fg-muted)]">
                        {p.sku}
                        {cat ? ` · ${cat}` : ''}
                      </p>
                      <div className="mt-1">
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-end gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <p className="mb-1 text-xs font-medium text-[var(--fg-muted)]">Stock</p>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 shrink-0 rounded-xl px-0 sm:h-11 sm:w-11"
                          onClick={() => bump(p, -1)}
                          aria-label="Decrease stock"
                        >
                          <SiteIcon name="minus" size={14} />
                        </Button>
                        <Input
                          type="number"
                          min={0}
                          className="w-20 text-center sm:w-24"
                          value={stock}
                          onChange={(e) =>
                            setDraft(p, { stock: Math.max(0, Number(e.target.value) || 0) })
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-10 w-10 shrink-0 rounded-xl px-0 sm:h-11 sm:w-11"
                          onClick={() => bump(p, 1)}
                          aria-label="Increase stock"
                        >
                          <SiteIcon name="plus" size={14} />
                        </Button>
                      </div>
                    </div>

                    <div className="w-24 sm:w-28">
                      <Input
                        label="Low alert"
                        type="number"
                        min={0}
                        value={threshold}
                        onChange={(e) =>
                          setDraft(p, {
                            threshold: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                      />
                    </div>

                    <div className="flex gap-2 pb-0.5">
                      <Button
                        size="sm"
                        disabled={!changed}
                        loading={savingId === p._id}
                        onClick={() =>
                          save.mutate({
                            id: p._id,
                            stock,
                            lowStockThreshold: threshold,
                          })
                        }
                      >
                        Save
                      </Button>
                      {changed ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setEdits((prev) => {
                              const next = { ...prev }
                              delete next[p._id]
                              return next
                            })
                          }
                        >
                          Undo
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {!rows.length ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] px-6 py-12 text-center">
              <p className="font-medium">No products match</p>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                {list.length === 0
                  ? 'Add products first, then manage stock here.'
                  : 'Try another filter or search.'}
              </p>
              {list.length === 0 ? (
                <Link to="/admin/products/new" className="mt-4 inline-block">
                  <Button size="sm">
                    <SiteIcon name="plus" size={14} /> Add product
                  </Button>
                </Link>
              ) : null}
            </div>
          ) : null}

          <Pagination
            page={page}
            pages={products.data?.meta?.pages || 1}
            onChange={setPage}
          />
        </div>
      )}

      {dirtyCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)]/95 px-4 py-3 backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:hidden">
          <Button
            className="h-11 w-full rounded-full"
            loading={saveAll.isPending}
            onClick={() => saveAll.mutate()}
          >
            Save all ({dirtyCount})
          </Button>
        </div>
      ) : null}
    </div>
  )
}
