import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/store/toastStore'
import { formatCurrency } from '@/lib/format'

export function Coupons() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [form, setForm] = useState({
    code: '',
    type: 'percent' as 'percent' | 'fixed',
    value: 10,
    minOrder: 0,
    maxUses: 100,
  })

  const list = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => (await adminApi.coupons.list()).data.data,
  })

  const create = useMutation({
    mutationFn: () => adminApi.coupons.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      setForm({ code: '', type: 'percent', value: 10, minOrder: 0, maxUses: 100 })
      toast('Coupon created', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.coupons.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast('Coupon deleted', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const toggle = useMutation({
    mutationFn: (c: { _id: string; isActive: boolean }) =>
      adminApi.coupons.update(c._id, { isActive: !c.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-coupons'] })
      toast('Coupon updated', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Coupons</h1>
        <p className="text-sm text-[var(--fg-muted)]">Discount codes</p>
      </div>

      <form
        className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <Input
          label="Code"
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          required
        />
        <Select
          label="Type"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as 'percent' | 'fixed' })}
          options={[
            { value: 'percent', label: 'Percent' },
            { value: 'fixed', label: 'Fixed' },
          ]}
        />
        <Input
          label="Value (% or DH)"
          type="number"
          min={0}
          value={form.value}
          onChange={(e) => setForm({ ...form, value: Number(e.target.value) })}
        />
        <Input
          label="Min order (DH)"
          type="number"
          min={0}
          value={form.minOrder}
          onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })}
        />
        <div className="flex items-end">
          <Button type="submit" loading={create.isPending} className="w-full">
            Create
          </Button>
        </div>
      </form>

      {list.isLoading ? (
        <Spinner />
      ) : (
        <ul className="space-y-2">
          {list.data?.map((c) => (
            <li
              key={c._id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] px-4 py-3"
            >
              <div>
                <p className="font-semibold tracking-wide">{c.code}</p>
                <p className="text-sm text-[var(--fg-muted)]">
                  {c.type === 'percent' ? `${c.value}%` : formatCurrency(c.value)} · used {c.usedCount}/
                  {c.maxUses || '∞'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.isActive ? 'success' : 'danger'}>
                  {c.isActive ? 'Active' : 'Off'}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => toggle.mutate(c)}>
                  {c.isActive ? 'Turn off' : 'Turn on'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(c._id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
