import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { InventoryNav } from '@/components/admin/inventory/InventoryNav'
import { MOVEMENT_TYPE_LABELS, byName, invCard, movementProduct, movementTypeLabel, nativeSelect } from '@/components/admin/inventory/MovementLabels'
import { MovementFlow, MovementRefs } from '@/components/admin/inventory/MovementRow'
import { ReceiveProductPicker } from '@/components/admin/inventory/ReceiveProductPicker'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Pagination } from '@/components/ui/Pagination'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { Spinner } from '@/components/ui/Spinner'
import { formatDateTime } from '@/lib/format'
import type { MovementType } from '@/types'

function Qty({ qty }: { qty: number }) {
  return <span className="tabular-nums font-semibold">{qty}</span>
}

export function InventoryMovements() {
  const [params, setParams] = useSearchParams()
  const get = (k: string) => params.get(k) || ''
  const page = Math.max(Number(params.get('page') || 1), 1)
  const type = get('type')
  const from = get('from')
  const to = get('to')
  const product = get('product')
  const productName = get('productName')

  const set = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true }
    )

  const movements = useQuery({
    queryKey: ['admin-inventory', 'movements', { page, type, from, to, product }],
    queryFn: async () => {
      const res = await inventoryApi.movements({ page, limit: 30, type, from, to, product })
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })
  const items = movements.data?.items ?? []
  const filtered = Boolean(type || from || to || product)

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InventoryNav />
      <AdminHeader title="Stock log" description="Every stock change, who made it and why." />

      <section className={`${invCard} grid min-w-0 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-4`}>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium">Type</span>
          <select className={nativeSelect} value={type} onChange={(e) => set({ type: e.target.value })}>
            <option value="">All types</option>
            {(Object.keys(MOVEMENT_TYPE_LABELS) as MovementType[]).map((t) => (
              <option key={t} value={t}>
                {MOVEMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <Input label="From" type="date" value={from} max={to || undefined} onChange={(e) => set({ from: e.target.value })} />
        <Input label="To" type="date" value={to} min={from || undefined} onChange={(e) => set({ to: e.target.value })} />
        {product ? (
          <div className="flex min-w-0 flex-col gap-1.5 text-sm">
            <span className="font-medium">Product</span>
            <div className="flex h-11 min-w-0 items-center gap-2 rounded-xl border border-[var(--border)] px-3">
              <span className="min-w-0 flex-1 truncate">{productName || 'Selected product'}</span>
              <button
                type="button"
                aria-label="Clear product filter"
                className="text-[var(--fg-muted)] hover:text-[var(--fg)]"
                onClick={() => {
                  set({ product: undefined, productName: undefined })
                }}
              >
                <SiteIcon name="close" size={14} />
              </button>
            </div>
          </div>
        ) : (
          <ReceiveProductPicker
            onPick={(p) => {
              set({ product: p._id, productName: p.name })
            }}
          />
        )}
        {filtered ? (
          <div className="sm:col-span-2 lg:col-span-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setParams(new URLSearchParams(), { replace: true })
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}
      </section>

      {movements.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : movements.isError ? (
        <QueryErrorState onRetry={() => movements.refetch()} />
      ) : !items.length ? (
        <p className={`${invCard} px-4 py-10 text-center text-sm text-[var(--fg-muted)]`}>No stock changes found.</p>
      ) : (
        <>
          <ul className="space-y-2.5 md:hidden">
            {items.map((m) => {
              const p = movementProduct(m)
              return (
                <li key={m._id} className={`${invCard} space-y-1 p-3 text-sm`}>
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/admin/inventory/products/${p._id}`} className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{p.name}</span>
                      <span className="block truncate text-xs text-[var(--fg-muted)]">{p.sku}</span>
                    </Link>
                    <span className="shrink-0 text-right text-xs">
                      {movementTypeLabel(m.type)} · <Qty qty={m.qty} />
                    </span>
                  </div>
                  <p className="text-xs">
                    <MovementFlow m={m} />
                  </p>
                  {m.serials.length ? <p className="break-all font-mono text-[11px] text-[var(--fg-muted)]">{m.serials.join(', ')}</p> : null}
                  {m.reason ? <p className="break-words text-xs text-[var(--fg-muted)]">{m.reason}</p> : null}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <MovementRefs m={m} />
                    <span className="text-[var(--fg-muted)]">
                      {formatDateTime(m.createdAt)} · {byName(m.by)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className={`${invCard} hidden overflow-x-auto md:block`}>
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs text-[var(--fg-muted)]">
                <tr>
                  <th className="px-3 py-3 font-medium">Date</th>
                  <th className="px-3 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 font-medium">From → to (count after)</th>
                  <th className="px-3 py-3 font-medium">Serials</th>
                  <th className="px-3 py-3 font-medium">Reason</th>
                  <th className="px-3 py-3 font-medium">Reference</th>
                  <th className="px-3 py-3 font-medium">By</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => {
                  const p = movementProduct(m)
                  return (
                    <tr key={m._id} className="border-t border-[var(--border)] align-top">
                      <td className="whitespace-nowrap px-3 py-3 text-xs">{formatDateTime(m.createdAt)}</td>
                      <td className="px-3 py-3">
                        <Link to={`/admin/inventory/products/${p._id}`} className="block max-w-[14rem] truncate hover:text-[var(--brand-text)]">
                          {p.name}
                        </Link>
                        <span className="text-xs text-[var(--fg-muted)]">{p.sku}</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3">{movementTypeLabel(m.type)}</td>
                      <td className="px-3 py-3 text-right">
                        <Qty qty={m.qty} />
                      </td>
                      <td className="px-3 py-3">
                        <MovementFlow m={m} />
                      </td>
                      <td className="px-3 py-3">
                        {m.serials.length ? (
                          <p className="max-w-[10rem] truncate font-mono text-xs" title={m.serials.join(', ')}>
                            {m.serials.join(', ')}
                          </p>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <p className="max-w-[16rem] break-words text-xs">{m.reason || '—'}</p>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        <MovementRefs m={m} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs">{byName(m.by)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Pagination page={page} pages={movements.data?.meta?.pages || 1} onChange={(p) => set({ page: p > 1 ? String(p) : undefined })} />
    </div>
  )
}
