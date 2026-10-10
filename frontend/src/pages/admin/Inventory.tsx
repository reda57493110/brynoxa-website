import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { categoriesApi } from '@/api/categoriesApi'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { InventoryNav } from '@/components/admin/inventory/InventoryNav'
import { DashboardSummary } from '@/components/admin/inventory/DashboardSummary'
import { DashboardReports } from '@/components/admin/inventory/DashboardReports'
import { DashboardTable } from '@/components/admin/inventory/DashboardTable'
import { AddStockDialog, type AddStockTarget } from '@/components/admin/inventory/AddStockDialog'
import { cardClass } from '@/components/admin/customers/shared'
import { cn } from '@/lib/cn'
import type { Category, InventoryQueryParams } from '@/types'

const PAGE_SIZE = 25

const STOCK_OPTIONS = [
  { value: '', label: 'Any stock' },
  { value: 'in-stock', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'awaiting', label: 'To inspect / returns' },
  { value: 'defective', label: 'Defective' },
  { value: 'repair', label: 'In repair' },
  { value: 'non-sellable', label: 'Has non-sellable' },
]

const SORT_OPTIONS: { value: NonNullable<InventoryQueryParams['sort']>; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'available', label: 'In stock' },
  { value: 'physical', label: 'Physical' },
  { value: 'value', label: 'Value' },
  { value: 'nonSellable', label: 'Not sellable' },
]

const selectCls =
  'h-11 w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm text-[var(--fg)] outline-none ring-brand'

/** Debounced text input bound to a URL param. */
function useDebouncedParam(current: string, apply: (v: string) => void) {
  const [text, setText] = useState(current)
  useEffect(() => setText(current), [current])
  useEffect(() => {
    const v = text.trim()
    if (v === current) return
    const t = window.setTimeout(() => apply(v), 350)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [text])
  return [text, setText] as const
}

export function Inventory() {
  const [params, setParams] = useSearchParams()
  const get = (k: string) => params.get(k) || ''
  const [addStockFor, setAddStockFor] = useState<AddStockTarget | null>(null)

  const page = Math.max(Number(params.get('page') || 1), 1)
  const stock = get('status')
  const active = get('active') as InventoryQueryParams['active']
  const condition = get('condition') as InventoryQueryParams['condition']
  const category = get('category')
  const location = get('location')
  const sort = (get('sort') || 'name') as NonNullable<InventoryQueryParams['sort']>
  const dir = (get('dir') || (sort === 'name' ? 'asc' : 'desc')) as 'asc' | 'desc'

  const update = (patch: Record<string, string | undefined>) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(patch).forEach(([k, v]) => {
          if (!v) next.delete(k)
          else next.set(k, v)
        })
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true }
    )
  }

  const [q, setQ] = useDebouncedParam(get('q'), (v) => update({ q: v || undefined }))
  const [serial, setSerial] = useDebouncedParam(get('serial'), (v) => update({ serial: v || undefined }))
  const [supplier, setSupplier] = useDebouncedParam(get('supplier'), (v) => update({ supplier: v || undefined }))
  const moreActive = Boolean(get('serial') || get('supplier') || location)
  const [showMore, setShowMore] = useState(moreActive)

  const listParams: InventoryQueryParams = {
    page,
    limit: PAGE_SIZE,
    q: get('q') || undefined,
    serial: get('serial') || undefined,
    supplier: get('supplier') || undefined,
    condition: condition || undefined,
    category: category || undefined,
    active: active || undefined,
    location: location || undefined,
    status: stock || undefined,
    sort,
    dir,
  }

  const summary = useQuery({
    queryKey: ['admin-inventory', 'summary'],
    queryFn: async () => (await inventoryApi.summary()).data.data,
  })

  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data as Category[],
  })

  const list = useQuery({
    queryKey: ['admin-inventory', 'list', listParams],
    queryFn: async () => {
      const res = await inventoryApi.list(listParams)
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })

  const hasFilters = Boolean(get('q') || moreActive || condition || category || active || stock)

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InventoryNav />
      <AdminHeader title="Inventory" description="Stock, condition and status of every product." />

      {summary.isPending ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : summary.isError ? (
        <QueryErrorState onRetry={() => summary.refetch()} />
      ) : (
        <DashboardSummary
          summary={summary.data}
          lowActive={stock === 'low'}
          onLowStock={() => update({ status: stock === 'low' ? undefined : 'low' })}
        />
      )}

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold">Products</h2>
        <div className={cn(cardClass, 'space-y-2 p-3 sm:p-4')}>
          <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]">
            <Input placeholder="Search name or SKU" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search name or SKU" />
            <select className={selectCls} value={category} onChange={(e) => update({ category: e.target.value || undefined })} aria-label="Category">
              <option value="">All categories</option>
              {(categories.data ?? []).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select className={selectCls} value={condition || ''} onChange={(e) => update({ condition: e.target.value || undefined })} aria-label="Condition">
              <option value="">Any condition</option>
              <option value="new">New</option>
              <option value="refurbished">Refurbished</option>
              <option value="used">Used</option>
            </select>
            <select className={selectCls} value={active || ''} onChange={(e) => update({ active: e.target.value || undefined })} aria-label="Status">
              <option value="">Active & inactive</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select className={selectCls} value={stock} onChange={(e) => update({ status: e.target.value || undefined })} aria-label="Stock">
              {STOCK_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {showMore ? (
            <div className="grid min-w-0 gap-2 sm:grid-cols-3">
              <Input placeholder="Serial number" value={serial} onChange={(e) => setSerial(e.target.value)} aria-label="Serial number" />
              <Input placeholder="Supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} aria-label="Supplier" />
              <select className={selectCls} value={location} onChange={(e) => update({ location: e.target.value || undefined })} aria-label="Location">
                <option value="">Any location</option>
                {(summary.data?.locations ?? []).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <select
              className={cn(selectCls, 'h-9 w-auto')}
              value={sort}
              onChange={(e) => update({ sort: e.target.value, dir: undefined })}
              aria-label="Sort by"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  Sort: {o.label}
                </option>
              ))}
            </select>
            <select className={cn(selectCls, 'h-9 w-auto')} value={dir} onChange={(e) => update({ dir: e.target.value })} aria-label="Sort direction">
              <option value="asc">Ascending</option>
              <option value="desc">Descending</option>
            </select>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="h-9 rounded-xl px-2 text-sm font-medium text-[var(--brand-text)] hover:underline"
            >
              {showMore ? 'Fewer filters' : 'More filters'}
            </button>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQ('')
                  setSerial('')
                  setSupplier('')
                  setParams(new URLSearchParams(), { replace: true })
                }}
                className="h-9 rounded-xl border border-[var(--border)] px-3 text-sm hover:border-[var(--brand)]"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {list.isPending && !list.data ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : list.isError ? (
          <QueryErrorState onRetry={() => list.refetch()} />
        ) : (
          <div className={cn('space-y-3', list.isFetching && 'opacity-70 transition-opacity')}>
            <p className="text-xs text-[var(--fg-muted)]">{list.data.meta?.total ?? list.data.items.length} products</p>
            <DashboardTable rows={list.data.items} onAddStock={(row) => setAddStockFor(row)} />
            <Pagination page={page} pages={list.data.meta?.pages || 1} onChange={(p) => update({ page: String(p) })} />
          </div>
        )}
      </section>

      {summary.data ? (
        <details className="group">
          <summary className="cursor-pointer list-none font-display text-base font-semibold">
            <span className="inline-flex items-center gap-1.5">
              Reports
              <span className="text-xs font-normal text-[var(--fg-muted)] group-open:hidden">(show)</span>
            </span>
          </summary>
          <div className="mt-3">
            <DashboardReports summary={summary.data} />
          </div>
        </details>
      ) : null}

      <AddStockDialog product={addStockFor} onClose={() => setAddStockFor(null)} />
    </div>
  )
}
