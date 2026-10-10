import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { InventoryNav } from '@/components/admin/inventory/InventoryNav'
import {
  REPAIR_SOURCE_LABELS,
  REPAIR_STATUS_LABELS,
  invCard,
  nativeSelect,
  repairStatusVariant,
} from '@/components/admin/inventory/MovementLabels'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { formatCurrency, formatDate } from '@/lib/format'
import type { RepairStatus } from '@/types'

const OPEN_FILTERS: { value: 'true' | 'false' | ''; label: string }[] = [
  { value: 'true', label: 'Open' },
  { value: 'false', label: 'Closed' },
  { value: '', label: 'All' },
]

const chip = (active: boolean) =>
  cn(
    'inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition',
    active ? 'border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-text)]' : 'border-[var(--border)] text-[var(--fg-muted)] hover:text-[var(--fg)]'
  )

export function InventoryRepairs() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(Number(params.get('page') || 1), 1)
  const open = (params.has('open') ? params.get('open') || '' : 'true') as 'true' | 'false' | ''
  const status = (params.get('status') || '') as RepairStatus | ''

  const set = (patch: Record<string, string | undefined>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        Object.entries(patch).forEach(([k, v]) => (v === undefined ? next.delete(k) : next.set(k, v)))
        if (!('page' in patch)) next.delete('page')
        return next
      },
      { replace: true }
    )

  const repairs = useQuery({
    queryKey: ['admin-inventory', 'repairs', { page, open, status }],
    queryFn: async () => {
      const res = await inventoryApi.repairs({ page, limit: 20, open, status })
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })
  const items = repairs.data?.items ?? []

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InventoryNav />
      <AdminHeader title="Repairs" description="Units only become sellable after passing QC with approval." />

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2" role="group" aria-label="Open or closed">
          {OPEN_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              type="button"
              aria-pressed={open === f.value}
              className={chip(open === f.value)}
              onClick={() => set({ open: f.value === 'true' ? undefined : f.value })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="sm:w-56">
          <span className="sr-only">Repair status</span>
          <select className={nativeSelect} value={status} onChange={(e) => set({ status: e.target.value || undefined })}>
            <option value="">Any status</option>
            {(Object.keys(REPAIR_STATUS_LABELS) as RepairStatus[]).map((s) => (
              <option key={s} value={s}>
                {REPAIR_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {repairs.isPending ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : repairs.isError ? (
        <QueryErrorState onRetry={() => repairs.refetch()} />
      ) : !items.length ? (
        <p className={`${invCard} px-4 py-10 text-center text-sm text-[var(--fg-muted)]`}>No repairs match these filters.</p>
      ) : (
        <>
          <ul className="space-y-2.5 md:hidden">
            {items.map((r) => (
              <li key={r._id}>
                <Link to={`/admin/inventory/repairs/${r._id}`} className={`${invCard} block p-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="truncate text-xs text-[var(--fg-muted)]">
                        {r.serial ? <span className="font-mono">{r.serial}</span> : `${r.qty} unit${r.qty === 1 ? '' : 's'}`} ·{' '}
                        {REPAIR_SOURCE_LABELS[r.source]}
                      </p>
                    </div>
                    <Badge variant={repairStatusVariant(r.status)}>{REPAIR_STATUS_LABELS[r.status]}</Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-2 break-words text-xs">{r.reportedFault}</p>
                  <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
                    {r.technician ? `${r.technician} · ` : ''}
                    {r.cost ? `${formatCurrency(r.cost)} · ` : ''}
                    {formatDate(r.updatedAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className={`${invCard} hidden overflow-x-auto md:block`}>
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs text-[var(--fg-muted)]">
                <tr>
                  <th className="px-3 py-3 font-medium">Product</th>
                  <th className="px-3 py-3 font-medium">Serial</th>
                  <th className="px-3 py-3 text-right font-medium">Qty</th>
                  <th className="px-3 py-3 font-medium">Source</th>
                  <th className="px-3 py-3 font-medium">Fault</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Technician</th>
                  <th className="px-3 py-3 text-right font-medium">Cost</th>
                  <th className="px-3 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr
                    key={r._id}
                    className="cursor-pointer border-t border-[var(--border)] align-top hover:bg-[var(--bg-muted)]/50"
                    onClick={() => navigate(`/admin/inventory/repairs/${r._id}`)}
                  >
                    <td className="px-3 py-3">
                      <Link to={`/admin/inventory/repairs/${r._id}`} className="block max-w-[14rem] truncate font-medium hover:text-[var(--brand-text)]" onClick={(e) => e.stopPropagation()}>
                        {r.name}
                      </Link>
                      <span className="text-xs text-[var(--fg-muted)]">{r.sku}</span>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{r.serial || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.qty}</td>
                    <td className="px-3 py-3">{REPAIR_SOURCE_LABELS[r.source]}</td>
                    <td className="px-3 py-3">
                      <p className="max-w-[16rem] truncate">{r.reportedFault}</p>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={repairStatusVariant(r.status)}>{REPAIR_STATUS_LABELS[r.status]}</Badge>
                    </td>
                    <td className="px-3 py-3">{r.technician || '—'}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.cost ? formatCurrency(r.cost) : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-[var(--fg-muted)]">{formatDate(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Pagination page={page} pages={repairs.data?.meta?.pages || 1} onChange={(p) => set({ page: p > 1 ? String(p) : undefined })} />
    </div>
  )
}
