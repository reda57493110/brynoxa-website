import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/api/inventoryApi'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { toast } from '@/store/toastStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SafeImage } from '@/components/ui/SafeImage'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { InventoryNav } from '@/components/admin/inventory/InventoryNav'
import { cardClass } from '@/components/admin/customers/shared'
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
  'inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-sm hover:border-[var(--brand)] hover:text-[var(--brand-text)]'

export function InventoryProduct() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const role = useAuthStore((s) => s.user?.role)
  const canApprove = hasPermission(role, 'inventory:approve')
  const canDelete = hasPermission(role, 'products:delete')
  const [addingStock, setAddingStock] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const navigate = useNavigate()

  const remove = useMutation({
    mutationFn: () => adminApi.products.remove(id),
    onSuccess: () => {
      toast.success('Product deleted')
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      navigate('/admin/inventory', { replace: true })
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

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

  // Only statuses that actually hold units
  const held: { label: string; value: number; tone?: 'danger' }[] = [
    { label: 'Reserved', value: b.reserved },
    { label: 'To inspect', value: b.awaitingInspection },
    { label: 'Returns', value: b.returned },
    { label: 'Defective', value: b.defective, tone: 'danger' as const },
    { label: 'In repair', value: b.underRepair },
    ...Object.entries(d.custom).map(([cid, n]) => ({
      label: statuses.find((s) => s.id === cid)?.name || 'Custom status',
      value: n,
    })),
  ].filter((c) => c.value > 0)

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
        <div className="mt-2 flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[var(--bg-muted)] sm:h-14 sm:w-14">
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
              <h1 className="truncate font-display text-base font-semibold tracking-tight sm:text-xl">{p.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--fg-muted)]">
                <ConditionBadge condition={p.condition} />
                {p.serialTracking ? <Badge variant="muted">Serial</Badge> : null}
                <span className="truncate">
                  {p.sku}
                  {p.location ? ` · ${p.location}` : ''}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => setAddingStock(true)}>
              <SiteIcon name="plus" size={14} /> Add stock
            </Button>
            <ActiveToggle product={p} size="sm" />
            <Link to={`/admin/products/${p._id}/edit`} className={linkBtn}>
              <SiteIcon name="pencil" size={14} /> Edit
            </Link>
            <a href={`/product/${p.slug}`} target="_blank" rel="noreferrer" className={linkBtn} aria-label="View in store">
              <SiteIcon name="external" size={14} /> <span className="hidden sm:inline">Store</span>
            </a>
            {canDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Delete product"
                className={cn(linkBtn, 'text-[var(--danger)] hover:border-[var(--danger)] hover:text-[var(--danger)]')}
              >
                <SiteIcon name="trash" size={14} /> <span className="hidden sm:inline">Delete</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <section className={cn(cardClass, 'min-w-0 p-3 sm:p-4')}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div>
            <dt className="text-[11px] text-[var(--fg-muted)]">Sellable</dt>
            <dd
              className={cn(
                'font-display text-xl font-semibold tabular-nums',
                d.sellable <= 0 ? 'text-[var(--danger)]' : low && 'text-[var(--warning)]'
              )}
            >
              {d.sellable}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--fg-muted)]">Total in stock</dt>
            <dd className="font-display text-xl font-semibold tabular-nums">{d.physical}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--fg-muted)]">Stock value</dt>
            <dd className="text-sm font-semibold">
              <ValueText value={d.value} />
              {d.unitCost !== null ? (
                <span className="block text-[11px] font-normal text-[var(--fg-muted)]">{formatCurrency(d.unitCost)} / unit</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-[var(--fg-muted)]">Price</dt>
            <dd className="text-sm font-semibold">{formatCurrency(p.price)}</dd>
          </div>
        </dl>

        <div className="mt-3">
          <SellableBar sellable={d.sellable} nonSellable={d.nonSellable} />
        </div>

        {held.length || low || b.writtenOff || (p.serialTracking && d.untrackedUnits > 0) || d.uncostedUnits > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {low ? (
              <Badge variant={d.sellable <= 0 ? 'danger' : 'warning'}>
                {d.sellable <= 0 ? 'Out of stock' : 'Low stock'} · alert ≤ {p.lowStockThreshold}
              </Badge>
            ) : null}
            {held.map((c) => (
              <span
                key={c.label}
                className={cn(
                  'rounded-full border border-[var(--border)] px-2 py-0.5',
                  c.tone === 'danger' && 'border-[color-mix(in_srgb,var(--danger)_40%,transparent)] text-[var(--danger)]'
                )}
              >
                {c.label} <strong className="tabular-nums">{c.value}</strong>
              </span>
            ))}
            {b.writtenOff ? (
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[var(--fg-muted)]">
                Written off <strong className="tabular-nums">{b.writtenOff}</strong>
              </span>
            ) : null}
            {p.serialTracking && d.untrackedUnits > 0 ? (
              <Badge variant="warning">{d.untrackedUnits} without serial</Badge>
            ) : null}
            {d.uncostedUnits > 0 ? <Badge variant="warning">{d.uncostedUnits} without cost</Badge> : null}
          </div>
        ) : null}
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start">
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
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${p.name}?`}
        description={`This permanently removes the product and its images from the catalog${
          d.sellable + d.nonSellable > 0 ? ` (${d.sellable + d.nonSellable} units still recorded in stock)` : ''
        }. To just hide it from the shop, set it to Inactive instead.`}
        confirmLabel="Delete permanently"
        loading={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      />
    </div>
  )
}
