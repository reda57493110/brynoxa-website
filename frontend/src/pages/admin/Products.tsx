import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SafeImage } from '@/components/ui/SafeImage'
import { optimizedImageUrl } from '@/lib/image'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { formatCurrency } from '@/lib/format'
import { toast } from '@/store/toastStore'
import type { Category } from '@/types'

export function Products() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const cats = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data,
  })

  const filters = useMemo(
    () => ({
      page,
      limit: 12,
      q: q || undefined,
      category: category || undefined,
      isActive: active === 'all' ? undefined : active === 'true',
      admin: true,
    }),
    [page, q, category, active]
  )

  const products = useQuery({
    queryKey: ['admin-products', filters],
    queryFn: async () => {
      const res = await adminApi.products.list(filters)
      return { items: res.data.data, meta: res.data.meta }
    },
    placeholderData: keepPreviousData,
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.products.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      toast.success('Product deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const pages = products.data?.meta?.pages || 1

  return (
    <div className="min-w-0 space-y-4 sm:space-y-6">
      <AdminHeader
        title="Products"
        description={`${products.data?.meta?.total ?? '—'} in catalog · includes hidden items`}
        actions={
          <Link to="/admin/products/new" className="w-full sm:w-auto">
            <Button size="sm" className="w-full sm:h-11 sm:px-4 sm:text-sm">
              <SiteIcon name="plus" size={16} /> Add product
            </Button>
          </Link>
        }
      />

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="min-w-0 flex-1 sm:min-w-[12rem]">
          <Input
            placeholder="Search name or SKU"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:contents">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value)
              setPage(1)
            }}
            className="h-10 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm sm:h-11 sm:px-3"
          >
            <option value="">All categories</option>
            {(cats.data as Category[] | undefined)?.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={active}
            onChange={(e) => {
              setActive(e.target.value as typeof active)
              setPage(1)
            }}
            className="h-10 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-2.5 text-sm sm:h-11 sm:px-3"
          >
            <option value="all">All status</option>
            <option value="true">Active</option>
            <option value="false">Hidden</option>
          </select>
        </div>
      </div>

      {products.isPending && !products.data ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : products.isError ? (
        <QueryErrorState onRetry={() => products.refetch()} />
      ) : (
        <>
          <div className="space-y-2.5 md:hidden">
            {products.data?.items.map((p) => {
              const img = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
              const cat = typeof p.category === 'object' ? p.category.name : ''
              return (
                <div
                  key={p._id}
                  className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-3"
                >
                  <div className="flex min-w-0 gap-2.5">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                      {img ? (
                        <SafeImage src={optimizedImageUrl(img, 240)} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--fg-muted)]">
                        {cat || '—'} · {p.sku}
                      </p>
                      <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-1.5 text-sm">
                        <span className="font-semibold tabular-nums">{formatCurrency(p.price)}</span>
                        {p.compareAtPrice && p.compareAtPrice > p.price ? (
                          <span className="text-[11px] text-[var(--fg-muted)] line-through tabular-nums">
                            {formatCurrency(p.compareAtPrice)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-1">
                    <Badge variant={p.isActive ? 'success' : 'danger'}>
                      {p.isActive ? 'Active' : 'Hidden'}
                    </Badge>
                    {p.stock <= p.lowStockThreshold ? (
                      <Badge variant="warning">{p.stock} left</Badge>
                    ) : (
                      <span className="text-[11px] text-[var(--fg-muted)]">{p.stock} in stock</span>
                    )}
                    {p.isFeatured ? <Badge variant="brand">Featured</Badge> : null}
                    {p.isCarousel ? <Badge variant="brand">Carousel</Badge> : null}
                  </div>
                  <div className="mt-2.5 flex min-w-0 items-center gap-2">
                    <Link to={`/admin/products/${p._id}/edit`} className="min-w-0 flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <SiteIcon name="pencil" size={14} /> Edit
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      aria-label="Delete product"
                      onClick={() => {
                        setDeleteId(p._id)
                      }}
                    >
                      <SiteIcon name="trash" size={16} />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden min-w-0 overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] md:block">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-[var(--fg-muted)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {products.data?.items.map((p) => {
                  const img = p.images?.find((i) => i.isPrimary)?.url || p.images?.[0]?.url
                  const cat = typeof p.category === 'object' ? p.category.name : ''
                  return (
                    <tr key={p._id} className="border-t border-[var(--border)]">
                      <td className="max-w-[16rem] px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                            {img ? (
                              <SafeImage src={optimizedImageUrl(img, 240)} alt="" className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{p.name}</p>
                            <p className="truncate text-xs text-[var(--fg-muted)]">{cat}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">
                        <span className="block max-w-[8rem] truncate">{p.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span className="font-medium tabular-nums">{formatCurrency(p.price)}</span>
                          {p.compareAtPrice && p.compareAtPrice > p.price ? (
                            <span className="text-xs text-[var(--fg-muted)] line-through tabular-nums">
                              {formatCurrency(p.compareAtPrice)}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.stock <= p.lowStockThreshold ? (
                          <Badge variant="warning">{p.stock}</Badge>
                        ) : (
                          p.stock
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex max-w-[12rem] flex-wrap gap-1">
                          <Badge variant={p.isActive ? 'success' : 'danger'}>
                            {p.isActive ? 'Active' : 'Hidden'}
                          </Badge>
                          {p.isFeatured ? <Badge variant="brand">Featured</Badge> : null}
                          {p.isCarousel ? <Badge variant="brand">Carousel</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link to={`/admin/products/${p._id}/edit`}>
                            <Button variant="ghost" size="sm" aria-label="Edit">
                              <SiteIcon name="pencil" size={16} />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete"
                            onClick={() => {
                              setDeleteId(p._id)
                            }}
                          >
                            <SiteIcon name="trash" size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </>
      )}
      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete product?"
        description="This permanently removes the product from the catalog."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) remove.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
        }}
      />
    </div>
  )
}
