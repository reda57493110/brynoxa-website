import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { InventoryNav } from '@/components/admin/inventory/InventoryNav'
import { StatCard, cardClass } from '@/components/admin/customers/shared'
import { ConditionBadge, SellableBar, ValueText } from '@/components/admin/inventory/ProductBadges'
import { ActiveToggle } from '@/components/admin/ActiveToggle'
import { AddStockDialog } from '@/components/admin/inventory/AddStockDialog'
import { ProductActions } from '@/components/admin/inventory/ProductActions'
import { ProductListings } from '@/components/admin/inventory/ProductListings'
import { ProductHistory } from '@/components/admin/inventory/ProductHistory'
import { formatCurrency } from '@/lib/format'
import { optimizedImageUrl } from '@/lib/image'
import { hasPermission } from '@/lib/permissions'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/cn'

const linkBtn =
  'inline-flex h-9 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-sm hover:border-[var(--brand)] hover:text-[var(--brand-text)]'

export function InventoryProduct() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const canApprove = hasPermission(role, 'inventory:approve')
  const [addingStock, setAddingStock] = useState(false)

  const detail = useQuery({
    queryKey: ['admin-inventory', 'product', id],
    queryFn: async () => (await inventoryApi.product(id)).data.data,
    enabled: Boolean(id),
  })
  const summary = useQuery({
    queryKey: ['admin-inventory', 'summary'],
    queryFn: async () => (await inventoryApi.summary()).data.data,
  })
  const statuses = summary.data?.statuses ?? []

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-inventory'] })
    qc.invalidateQueries({ queryKey: ['admin-products'] })
  }

  if (detail.isPending) {
    return (
      <div className="space-y-4">
        <InventoryNav />
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </div>
    )
  }
  if (detail.isError) {
    return (
      <div className="space-y-4">
        <InventoryNav />
        <QueryErrorState onRetry={() => detail.refetch()} />
      </div>
    )
  }

  const d = detail.data
  const p = d.product
  const b = d.buckets
  const low = d.lowStock || d.sellable <= 0

  const cards: { label: string; value: number }[] = [
    { label: 'Reserved', value: b.reserved },
    { label: 'To inspect', value: b.awaitingInspection },
    { label: 'Returns', value: b.returned },
    { label: 'Defective', value: b.defective },
    { label: 'In repair', value: b.underRepair },
    ...Object.entries(d.custom)
      .filter(([, n]) => n > 0)
      .map(([cid, n]) => ({ label: statuses.find((s) => s.id === cid)?.name || 'Custom status', value: n })),
    { label: 'Written off', value: b.writtenOff },
  ]

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <InventoryNav />

      <div className="min-w-0">
        <Link
          to="/admin/inventory"
          className="inline-flex items-center gap-1 text-sm text-[var(--fg-muted)] hover:text-[var(--fg)]"
        >
          <SiteIcon name="arrow-left" size={14} /> Inventory
        </Link>
        <div className="mt-3 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-muted)] sm:h-20 sm:w-20">
            {p.image ? (
              <SafeImage
                src={optimizedImageUrl(p.image, 240)}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--fg-muted)]">
                <SiteIcon name="package" size={22} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-semibold tracking-tight break-words sm:text-2xl">{p.name}</h1>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              {p.sku}
              {p.location ? ` · ${p.location}` : ''}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ConditionBadge condition={p.condition} />
              {p.serialTracking ? <Badge variant="muted">Serial tracked</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setAddingStock(true)}>
              <SiteIcon name="plus" size={14} /> Add stock
            </Button>
            <ActiveToggle product={p} />
            <Link to={`/admin/products/${p._id}/edit`} className={linkBtn}>
              <SiteIcon name="pencil" size={14} /> Edit product
            </Link>
            <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className={linkBtn}>
              <SiteIcon name="external" size={14} /> Store page
            </a>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className={cn(cardClass, 'min-w-0 p-3 sm:p-4')}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-[var(--fg-muted)]">In stock</p>
              <p className="mt-1 font-display text-lg font-semibold sm:text-xl">{d.physical}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--fg-muted)]">Sellable</p>
              <p
                className={cn(
                  'mt-1 font-display text-lg font-semibold sm:text-xl',
                  d.sellable <= 0 ? 'text-[var(--danger)]' : low && 'text-[var(--warning)]'
                )}
              >
                {d.sellable}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <SellableBar sellable={d.sellable} nonSellable={d.nonSellable} />
          </div>
          {low ? (
            <p className="mt-2 text-xs text-[var(--warning)]">
              {d.sellable <= 0 ? 'Out of stock' : 'Low stock'} · alert at {p.lowStockThreshold}
            </p>
          ) : null}
        </div>
        <StatCard
          label="Stock value"
          value={<ValueText value={d.value} className={d.value === null ? 'text-sm' : undefined} />}
          hint={
            <>
              {d.unitCost !== null ? `${formatCurrency(d.unitCost)} / unit` : null}
              {d.uncostedUnits > 0 ? (
                <span className="block text-[var(--warning)]">No cost · {d.uncostedUnits} units</span>
              ) : null}
            </>
          }
        />
        <StatCard
          label="Defective value"
          value={<ValueText value={d.defectiveValue} className={d.defectiveValue === null ? 'text-sm' : undefined} />}
          hint={`${b.defective} units`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c, i) => (
          <StatCard key={`${i}-${c.label}`} label={c.label} value={c.value} />
        ))}
      </div>

      {p.serialTracking && d.untrackedUnits > 0 ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--warning)_14%,transparent)] px-3 py-2 text-sm text-[var(--warning)]">
          {d.untrackedUnits} unit{d.untrackedUnits === 1 ? '' : 's'} without a serial number.
        </p>
      ) : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ProductActions detail={d} statuses={statuses} canApprove={canApprove} onDone={refresh} />
        <ProductListings detail={d} onDone={refresh} />
      </div>

      <ProductHistory detail={d} statuses={statuses} />

      <AddStockDialog
        product={
          addingStock ? { _id: p._id, name: p.name, sellable: d.sellable, serialTracking: p.serialTracking } : null
        }
        onClose={() => setAddingStock(false)}
      />
    </div>
  )
}
