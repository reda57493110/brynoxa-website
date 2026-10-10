import { useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { ActiveToggle } from '@/components/admin/ActiveToggle'
import { cardClass } from '@/components/admin/customers/shared'
import { formatCurrency } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { InventoryRow } from '@/types'
import { ConditionBadge } from './ProductBadges'

function Thumb({ src }: { src?: string }) {
  return (
    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
      {src ? (
        <SafeImage src={optimizedImageUrl(src, 120)} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[var(--fg-muted)]">
          <SiteIcon name="package" size={16} />
        </div>
      )}
    </div>
  )
}

function Tags({ row }: { row: InventoryRow }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <ConditionBadge condition={row.condition} />
      {row.category ? <span className="text-[11px] text-[var(--fg-muted)]">{row.category}</span> : null}
      {row.serialTracking ? <Badge variant="muted">Serial</Badge> : null}
    </div>
  )
}

function sellableClass(row: InventoryRow) {
  if (row.sellable <= 0) return 'text-[var(--danger)]'
  if (row.lowStock) return 'text-[var(--warning)]'
  return ''
}

/** Units held back (not for sale), with the breakdown on hover. */
function heldTitle(row: InventoryRow) {
  const b = row.buckets
  return [
    b.reserved && `${b.reserved} reserved`,
    b.awaitingInspection && `${b.awaitingInspection} to inspect`,
    b.returned && `${b.returned} returned`,
    b.defective && `${b.defective} defective`,
    b.underRepair && `${b.underRepair} in repair`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Inline low-stock alert editor (no reason needed). */
function ThresholdEdit({ row }: { row: InventoryRow }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(String(row.lowStockThreshold))
  const save = useMutation({
    mutationFn: (n: number) => adminApi.products.inventory(row._id, { lowStockThreshold: n }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      toast.success('Alert level saved')
      setEditing(false)
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const stop = (e: MouseEvent) => e.stopPropagation()

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          stop(e)
          setValue(String(row.lowStockThreshold))
          setEditing(true)
        }}
        className="inline-flex items-center gap-1 text-[11px] text-[var(--fg-muted)] hover:text-[var(--brand-text)]"
        aria-label={`Edit low-stock alert for ${row.name}`}
      >
        Alert ≤ {row.lowStockThreshold} <SiteIcon name="pencil" size={11} />
      </button>
    )
  }
  return (
    <form
      onClick={stop}
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(Math.max(0, Math.trunc(Number(value) || 0)))
      }}
      className="inline-flex items-center gap-1"
    >
      <input
        type="number"
        min={0}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-7 w-14 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-1.5 text-xs"
        aria-label="Low-stock alert level"
      />
      <button
        type="submit"
        disabled={save.isPending}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand)] text-[var(--brand-fg)] disabled:opacity-50"
        aria-label="Save alert level"
      >
        <SiteIcon name="check" size={12} />
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)]"
        aria-label="Cancel"
      >
        <SiteIcon name="close" size={12} />
      </button>
    </form>
  )
}

function AddStockButton({ row, onAddStock, block }: { row: InventoryRow; onAddStock: (row: InventoryRow) => void; block?: boolean }) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn('shrink-0', block && 'flex-1')}
      onClick={(e) => {
        e.stopPropagation()
        onAddStock(row)
      }}
    >
      <SiteIcon name="plus" size={14} />
      Add stock
    </Button>
  )
}

export function DashboardTable({ rows, onAddStock }: { rows: InventoryRow[]; onAddStock: (row: InventoryRow) => void }) {
  const navigate = useNavigate()
  const open = (id: string) => navigate(`/admin/inventory/products/${id}`)

  if (!rows.length) {
    return (
      <p className={`${cardClass} px-4 py-10 text-center text-sm text-[var(--fg-muted)]`}>
        No products match these filters.
      </p>
    )
  }

  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="space-y-2.5 md:hidden">
        {rows.map((r) => (
          <div key={r._id} className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3">
            <Link to={`/admin/inventory/products/${r._id}`} className="flex min-w-0 items-start gap-2.5">
              <Thumb src={r.image} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-[11px] text-[var(--fg-muted)]">
                  {r.sku} · {formatCurrency(r.price)}
                </p>
                <Tags row={r} />
              </div>
              <div className="shrink-0 text-end">
                <p className={cn('font-display text-lg font-semibold', sellableClass(r))}>{r.sellable}</p>
                <p className="text-[11px] text-[var(--fg-muted)]">In stock</p>
              </div>
            </Link>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <ThresholdEdit row={r} />
              {r.nonSellable ? (
                <span className="text-[var(--fg-muted)]" title={heldTitle(r)}>
                  +{r.nonSellable} not sellable
                </span>
              ) : null}
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <AddStockButton row={r} onAddStock={onAddStock} block />
              <ActiveToggle product={r} size="sm" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop */}
      <div className={`${cardClass} hidden min-w-0 overflow-x-auto md:block`}>
        <table className="w-full min-w-[860px] text-start text-sm">
          <thead className="bg-[var(--bg-muted)] text-xs text-[var(--fg-muted)]">
            <tr>
              <th className="px-3 py-3 text-start font-medium">Product</th>
              <th className="px-3 py-3 text-end font-medium">Price</th>
              <th className="px-3 py-3 text-end font-medium">In stock</th>
              <th className="px-3 py-3 text-end font-medium">Not sellable</th>
              <th className="px-3 py-3 text-start font-medium">Status</th>
              <th className="px-3 py-3 text-end font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r._id}
                onClick={() => open(r._id)}
                className="cursor-pointer border-t border-[var(--border)] align-top transition hover:bg-[var(--bg-muted)]/50"
              >
                <td className="max-w-[22rem] px-3 py-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Thumb src={r.image} />
                    <div className="min-w-0">
                      <Link
                        to={`/admin/inventory/products/${r._id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium hover:text-[var(--brand-text)]"
                      >
                        {r.name}
                      </Link>
                      <p className="truncate text-xs text-[var(--fg-muted)]">{r.sku}</p>
                      <Tags row={r} />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-end whitespace-nowrap tabular-nums">{formatCurrency(r.price)}</td>
                <td className="px-3 py-3 text-end whitespace-nowrap">
                  <p className={cn('font-semibold tabular-nums', sellableClass(r))}>{r.sellable}</p>
                  <ThresholdEdit row={r} />
                </td>
                <td className="px-3 py-3 text-end tabular-nums" title={heldTitle(r) || undefined}>
                  {r.nonSellable ? r.nonSellable : <span className="text-[var(--fg-muted)]">0</span>}
                </td>
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <ActiveToggle product={r} size="sm" />
                </td>
                <td className="px-3 py-3 text-end">
                  <AddStockButton row={r} onAddStock={onAddStock} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
