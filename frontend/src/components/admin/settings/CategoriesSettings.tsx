import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SPEC_TEMPLATES, getTemplate, isTemplateId, templateForCategory } from '@/lib/specs'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { Category } from '@/types'
import { SettingsCard } from './SettingsUi'
import { useReportDirty } from './dirty'

/** Catalog categories: add, show/hide, spec type and delete. Each change is saved right away. */
export function CategoriesSettings() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  useReportDirty('categories', Boolean(name.trim() || description.trim()))

  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data as Category[],
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['categories'] })

  const create = useMutation({
    mutationFn: () => adminApi.categories.create({ name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => {
      refresh()
      setName('')
      setDescription('')
      toast.success('Category added')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const update = useMutation({
    mutationFn: (v: { id: string; patch: Partial<Category> }) => adminApi.categories.update(v.id, v.patch),
    onSuccess: () => {
      refresh()
      toast.success('Category updated')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => adminApi.categories.remove(id),
    onSuccess: () => {
      refresh()
      setDeleteId(null)
      toast.success('Category deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const list = categories.data ?? []
  const pending = (id: string) => update.isPending && update.variables?.id === id

  return (
    <SettingsCard title="Categories" description="Changes here apply immediately. Spec type sets the specification fields in the product form.">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length >= 2) create.mutate()
        }}
      >
        <Input label="New category" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Laptops" maxLength={60} />
        <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
        <Button type="submit" className="shrink-0" loading={create.isPending} disabled={name.trim().length < 2}>
          <SiteIcon name="plus" size={14} /> Add
        </Button>
      </form>

      {categories.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : categories.isError ? (
        <QueryErrorState onRetry={() => categories.refetch()} />
      ) : list.length ? (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
          {list.map((c) => (
            <li key={c._id} className={cn('flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5', pending(c._id) && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {c.name}
                  {!c.isActive ? <span className="ms-2 text-xs font-normal text-[var(--fg-muted)]">hidden</span> : null}
                </p>
                <p className="truncate text-[11px] text-[var(--fg-muted)]">/{c.slug}</p>
              </div>
              <select
                aria-label={`Spec type for ${c.name}`}
                value={isTemplateId(c.specTemplate) ? c.specTemplate : ''}
                disabled={pending(c._id)}
                onChange={(e) => update.mutate({ id: c._id, patch: { specTemplate: e.target.value } })}
                className="h-8 max-w-[11rem] rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs"
              >
                <option value="">{getTemplate(templateForCategory({ ...c, specTemplate: undefined }, list)).label.en} (auto)</option>
                {SPEC_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label.en}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending(c._id)}
                onClick={() => update.mutate({ id: c._id, patch: { isActive: !c.isActive } })}
              >
                {c.isActive ? 'Hide' : 'Show'}
              </Button>
              <button
                type="button"
                onClick={() => setDeleteId(c._id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
                aria-label={`Delete ${c.name}`}
              >
                <SiteIcon name="trash" size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">No categories yet — add your first above.</p>
      )}
      <p className="text-[11px] text-[var(--fg-muted)]">Hidden categories and their products are not shown in the shop.</p>

      <ConfirmDialog
        open={Boolean(deleteId)}
        title="Delete category?"
        description="Products in this category may no longer appear correctly. This cannot be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && remove.mutate(deleteId)}
      />
    </SettingsCard>
  )
}
