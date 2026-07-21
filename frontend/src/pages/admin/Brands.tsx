import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { brandsApi } from '@/api/brandsApi'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useToastStore } from '@/store/toastStore'

export function Brands() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [name, setName] = useState('')

  const list = useQuery({
    queryKey: ['brands'],
    queryFn: async () => (await brandsApi.list()).data.data,
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
              <span className="font-medium">{b.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => confirm('Delete?') && remove.mutate(b._id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
