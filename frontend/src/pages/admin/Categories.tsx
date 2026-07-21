import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoriesApi } from '@/api/categoriesApi'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { useToastStore } from '@/store/toastStore'

export function Categories() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const list = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.list()).data.data,
  })

  const create = useMutation({
    mutationFn: () => adminApi.categories.create({ name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setName('')
      setDescription('')
      toast('Category created', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.categories.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast('Category deleted', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Categories</h1>
        <p className="text-sm text-[var(--fg-muted)]">Organize the catalog</p>
      </div>

      <form
        className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          create.mutate()
        }}
      >
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button type="submit" loading={create.isPending}>
          Add
        </Button>
      </form>

      {list.isLoading ? (
        <Spinner />
      ) : (
        <ul className="space-y-2">
          {list.data?.map((c) => (
            <li
              key={c._id}
              className="flex items-center justify-between rounded-xl border border-[var(--border)] px-4 py-3"
            >
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-[var(--fg-muted)]">/{c.slug}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => confirm('Delete?') && remove.mutate(c._id)}
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
