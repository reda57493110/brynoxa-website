import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
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
    <div className="space-y-6">
      <AdminHeader
        title="Products"
        description={`${products.data?.meta?.total ?? '—'} in catalog · includes hidden items`}
        actions={
          <Link to="/admin/products/new">
            <Button>
              <SiteIcon name="plus" size={16} /> Add product
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="min-w-[14rem] flex-1">
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
          className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm"
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
          className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3 text-sm"
        >
          <option value="all">All status</option>
          <option value="true">Active</option>
          <option value="false">Hidden</option>
        </select>
      </div>

      {products.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
            <table className="w-full min-w-[800px] text-left text-sm">
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 overflow-hidden rounded-lg bg-[var(--bg-muted)]">
                            {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : null}
                          </div>
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-[var(--fg-muted)]">{cat}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--fg-muted)]">{p.sku}</td>
                      <td className="px-4 py-3">{formatCurrency(p.price)}</td>
                      <td className="px-4 py-3">
                        {p.stock <= p.lowStockThreshold ? (
                          <Badge variant="warning">{p.stock}</Badge>
                        ) : (
                          p.stock
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={p.isActive ? 'success' : 'danger'}>
                            {p.isActive ? 'Active' : 'Hidden'}
                          </Badge>
                          {p.isFeatured ? <Badge variant="brand">Featured</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link to={`/admin/products/${p._id}/edit`}>
                            <Button variant="ghost" size="sm">
                              <SiteIcon name="pencil" size={16} />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Delete this product?')) remove.mutate(p._id)
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
    </div>
  )
}
