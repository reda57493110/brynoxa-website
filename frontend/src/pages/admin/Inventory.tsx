import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '@/api/productsApi'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/store/toastStore'

export function Inventory() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [edits, setEdits] = useState<Record<string, number>>({})

  const products = useQuery({
    queryKey: ['admin-inventory'],
    queryFn: async () => (await productsApi.list({ limit: 100 })).data.data,
  })

  const save = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) =>
      adminApi.products.inventory(id, stock),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      toast('Stock updated', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Inventory</h1>
        <p className="text-sm text-[var(--fg-muted)]">Adjust stock levels</p>
      </div>

      {products.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {products.data?.map((p) => {
            const low = p.stock <= p.lowStockThreshold
            const value = edits[p._id] ?? p.stock
            return (
              <div
                key={p._id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{p.sku}</p>
                </div>
                {low && <Badge variant="warning">Low</Badge>}
                <Input
                  type="number"
                  min={0}
                  className="w-28"
                  value={value}
                  onChange={(e) =>
                    setEdits((prev) => ({ ...prev, [p._id]: Number(e.target.value) }))
                  }
                />
                <Button
                  size="sm"
                  loading={save.isPending}
                  onClick={() => save.mutate({ id: p._id, stock: value })}
                >
                  Save
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
