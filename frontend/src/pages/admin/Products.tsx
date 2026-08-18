import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { productsApi } from '@/api/productsApi'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/format'
import { useToastStore } from '@/store/toastStore'

export function Products() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)

  const products = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () =>
      (await productsApi.list({ limit: 100 })).data.data,
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.products.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      toast('Product deleted', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Products</h1>
          <p className="text-sm text-[var(--fg-muted)]">Manage catalog</p>
        </div>
        <Link to="/admin/products/new">
          <Button>
            <SiteIcon name="plus" size={16} /> Add product
          </Button>
        </Link>
      </div>

      {products.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)]">
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
              {products.data?.map((p) => (
                <tr key={p._id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-[var(--fg-muted)]">{p.sku}</td>
                  <td className="px-4 py-3">{formatCurrency(p.price)}</td>
                  <td className="px-4 py-3">{p.stock}</td>
                  <td className="px-4 py-3">
                    <Badge variant={p.isActive ? 'success' : 'danger'}>
                      {p.isActive ? 'Active' : 'Hidden'}
                    </Badge>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
