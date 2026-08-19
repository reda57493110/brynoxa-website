import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { brandsApi } from '@/api/brandsApi'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/store/toastStore'

export function Brands() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [name, setName] = useState('')

  const list = useQuery({
    queryKey: ['brands', 'all'],
    queryFn: async () => (await brandsApi.list(true)).data.data,
  })

  const create = useMutation({
    mutationFn: () => adminApi.brands.create({ name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] })
      setName('')
      toast('Brand created', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.brands.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] })
      toast('Brand deleted', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const toggle = useMutation({
    mutationFn: (b: { _id: string; isActive: boolean }) =>
      adminApi.brands.update(b._id, { isActive: !b.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brands'] })
      toast('Brand updated', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Brands</h1>
        <p className="text-sm text-[var(--fg-muted)]">Partner and house labels</p>
      </div>

      <form
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <Input label="Brand name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Button type="submit" loading={create.isPending}>
          Add
        </Button>
      </form>

      {list.isLoading ? (
        <Spinner />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.data?.map((b) => (
            <li
              key={b._id}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{b.name}</span>
                <Badge variant={b.isActive ? 'success' : 'danger'}>
                  {b.isActive ? 'On' : 'Off'}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => toggle.mutate(b)}>
                  {b.isActive ? 'Hide' : 'Show'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => confirm('Delete?') && remove.mutate(b._id)}
                >
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
