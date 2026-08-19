import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { AdminHeader } from '@/components/admin/AdminHeader'
import { toast } from '@/store/toastStore'

export function Inventory() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [edits, setEdits] = useState<Record<string, number>>({})

  const products = useQuery({
    queryKey: ['admin-inventory', q],
    queryFn: async () =>
      (await adminApi.products.list({ limit: 100, q: q || undefined, admin: true })).data.data,
  })

  const save = useMutation({
    mutationFn: ({ id, stock }: { id: string; stock: number }) =>
      adminApi.products.inventory(id, stock),
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: ['admin-inventory'] })
      qc.invalidateQueries({ queryKey: ['admin-dashboard'] })
      qc.invalidateQueries({ queryKey: ['admin-products'] })
      setEdits((prev) => {
        const next = { ...prev }
        delete next[vars.id]
        return next
      })
      toast.success('Stock updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const rows = useMemo(() => {
    const list = products.data ?? []
    return list.filter((p) => (lowOnly ? p.stock <= p.lowStockThreshold : true))
  }, [products.data, lowOnly])

  const dirty = Object.keys(edits).length

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Inventory"
        description="Edit stock live. Low items are flagged against each product’s threshold."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[14rem] flex-1">
          <Input placeholder="Search SKU or name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
          Low stock only
        </label>
        {dirty > 0 ? <Badge variant="warning">{dirty} unsaved</Badge> : null}
      </div>

      {products.isLoading ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {rows.map((p) => {
            const low = p.stock <= p.lowStockThreshold
            const value = edits[p._id] ?? p.stock
            const changed = edits[p._id] !== undefined && edits[p._id] !== p.stock
            return (
              <div
                key={p._id}
                className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex-1">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-[var(--fg-muted)]">{p.sku}</p>
                </div>
                {low ? <Badge variant="warning">Low (≤ {p.lowStockThreshold})</Badge> : null}
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
                  disabled={!changed}
                  loading={save.isPending}
                  onClick={() => save.mutate({ id: p._id, stock: value })}
                >
                  Save
                </Button>
              </div>
            )
          })}
          {!rows.length ? <p className="text-sm text-[var(--fg-muted)]">No products match.</p> : null}
        </div>
      )}
    </div>
  )
}
