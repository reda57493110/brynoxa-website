import { useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Badge } from '@/components/ui/Badge'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { cardClass } from '@/components/admin/customers/shared'
import { optimizedImageUrl } from '@/lib/image'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { InventoryRow } from '@/types'
import { ConditionBadge, ValueText } from './ProductBadges'

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
    <div className="mt-1 flex flex-wrap gap-1">
      <ConditionBadge condition={row.condition} />
      {row.serialTracking ? <Badge variant="muted">Serial</Badge> : null}
      {!row.isActive ? <Badge variant="danger">Inactive</Badge> : null}
    </div>
  )
}

function sellableClass(row: InventoryRow) {
  if (row.sellable <= 0) return 'text-[var(--danger)]'
  if (row.lowStock) return 'text-[var(--warning)]'
  return ''
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
        const n = Math.max(0, Math.trunc(Number(value) || 0))
        save.mutate(n)
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

const NUM_COLS: { key: keyof InventoryRow['buckets']; label: string }[] = [
  { key: 'reserved', label: 'Reserved' },
  { key: 'awaitingInspection', label: 'To inspect' },
  { key: 'returned', label: 'Returns' },
  { key: 'defective', label: 'Defective' },
  { key: 'underRepair', label: 'In repair' },
]

function n(v: number) {
  return v ? v : <span className="text-[var(--fg-muted)]">0</span>
}

export function DashboardTable({ rows }: { rows: InventoryRow[] }) {
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
                <p className="truncate text-[11px] text-[var(--fg-muted)]">{r.sku}</p>
                <Tags row={r} />
              </div>
              <div className="shrink-0 text-right">
                <p className={cn('font-display text-lg font-semibold', sellableClass(r))}>{r.sellable}</p>
                <p className="text-[11px] text-[var(--fg-muted)]">Sellable</p>
              </div>
            </Link>
            <dl className="mt-2.5 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
              {NUM_COLS.map((c) => (
                <div key={c.key} className="flex justify-between gap-1">
                  <dt className="truncate text-[var(--fg-muted)]">{c.label}</dt>
                  <dd>{r.buckets[c.key]}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-1">
                <dt className="text-[var(--fg-muted)]">Physical</dt>
                <dd>{r.physical}</dd>
              </div>
            </dl>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              <ThresholdEdit row={r} />
              <ValueText value={r.value} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table scrolls inside its card */}
      <div className={`${cardClass} hidden min-w-0 overflow-x-auto md:block`}>
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-[var(--bg-muted)] text-xs text-[var(--fg-muted)]">
            <tr>
              <th className="px-3 py-3 font-medium">Product</th>
              <th className="px-3 py-3 text-right font-medium">Sellable</th>
              {NUM_COLS.map((c) => (
                <th key={c.key} className="px-3 py-3 text-right font-medium">
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium">Physical</th>
              <th className="px-3 py-3 text-right font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r._id}
                onClick={() => open(r._id)}
                className="cursor-pointer border-t border-[var(--border)] align-top transition hover:bg-[var(--bg-muted)]/50"
              >
                <td className="max-w-[20rem] px-3 py-3">
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
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <p className={cn('font-semibold', sellableClass(r))}>{r.sellable}</p>
                  <ThresholdEdit row={r} />
                </td>
                {NUM_COLS.map((c) => (
                  <td key={c.key} className="px-3 py-3 text-right">
                    {n(r.buckets[c.key])}
                  </td>
                ))}
                <td className="px-3 py-3 text-right font-medium">{r.physical}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">
                  <ValueText value={r.value} />
                  {r.value !== null && r.uncostedUnits > 0 ? (
                    <p className="text-[11px] text-[var(--warning)]">+{r.uncostedUnits} no cost</p>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
