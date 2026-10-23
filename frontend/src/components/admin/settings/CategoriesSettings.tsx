import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { categoriesApi } from '@/api/categoriesApi'
import { uploadApi } from '@/api/uploadApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { SPEC_TEMPLATES, getTemplate, isTemplateId, templateForCategory } from '@/lib/specs'
import { BUILT_IN_CATEGORY_PHOTOS, categoryPhoto } from '@/lib/categoryPhoto'
import { prepareImageForUpload } from '@/lib/prepareImage'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { Category } from '@/types'
import { SettingsCard } from './SettingsUi'
import { useReportDirty } from './dirty'

/** Uploads one photo (made safe for the server first) and returns its address. */
async function uploadPhoto(file: File) {
  const { blob, filename } = await prepareImageForUpload(file)
  return (await uploadApi.image(blob, filename)).data.data.url
}

/**
 * The category photo as the home page shows it: fills a rounded tile edge to edge. Click (or the
 * button) to pick a photo; "Built-in photo" goes back to the store's own photo when there is one.
 */
function CategoryPhotoPicker({
  photo,
  custom,
  hasBuiltIn,
  uploading,
  onPick,
  onReset,
  className,
}: {
  photo?: string
  custom: boolean
  hasBuiltIn: boolean
  uploading: boolean
  onPick: (file: File) => void
  onReset?: () => void
  className?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="group relative aspect-[16/10] w-full overflow-hidden rounded-[1.35rem] border border-[var(--border)] bg-[var(--bg-muted)] text-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
        aria-label={photo ? 'Change photo' : 'Add photo'}
      >
        {photo ? (
          <img src={photo} alt="" className="absolute inset-0 h-full w-full rounded-[calc(1.35rem-1px)] object-cover" />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-xs text-[var(--fg-muted)]">
            <SiteIcon name="plus" size={18} />
            Add photo
          </span>
        )}
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/45 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100',
            uploading && 'opacity-100'
          )}
        >
          {uploading ? <Spinner /> : photo ? 'Change photo' : 'Add photo'}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPick(file)
        }}
      />
      {custom && onReset ? (
        <button
          type="button"
          onClick={onReset}
          className="self-start text-[11px] text-[var(--fg-muted)] underline-offset-2 hover:text-[var(--danger)] hover:underline"
        >
          {hasBuiltIn ? 'Use the built-in photo' : 'Remove photo'}
        </button>
      ) : null}
    </div>
  )
}

/** Catalog categories: add (with photo), photo, show/hide, spec type and delete. Saved right away. */
export function CategoriesSettings() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [newPhoto, setNewPhoto] = useState('')
  const [newUploading, setNewUploading] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const [moveTo, setMoveTo] = useState('')
  useReportDirty('categories', Boolean(name.trim() || description.trim() || newPhoto))

  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data as Category[],
  })
  const refresh = () => qc.invalidateQueries({ queryKey: ['categories'] })

  const create = useMutation({
    mutationFn: () =>
      adminApi.categories.create({
        name: name.trim(),
        description: description.trim() || undefined,
        image: newPhoto || undefined,
      }),
    onSuccess: () => {
      refresh()
      setName('')
      setDescription('')
      setNewPhoto('')
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
    mutationFn: (v: { id: string; moveTo?: string }) => adminApi.categories.remove(v.id, v.moveTo),
    onSuccess: () => {
      refresh()
      qc.invalidateQueries({ queryKey: ['products'] })
      setDeleting(null)
      toast.success('Category deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const pickNewPhoto = async (file: File) => {
    setNewUploading(true)
    try {
      setNewPhoto(await uploadPhoto(file))
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
    setNewUploading(false)
  }

  const changePhoto = async (c: Category, file: File) => {
    setUploadingId(c._id)
    let image = ''
    try {
      image = await uploadPhoto(file)
    } catch (e) {
      toast.error(getErrorMessage(e))
    }
    setUploadingId(null)
    if (image) update.mutate({ id: c._id, patch: { image } })
  }

  const list = categories.data ?? []
  const pending = (id: string) => (update.isPending && update.variables?.id === id) || uploadingId === id
  const others = deleting ? list.filter((c) => c._id !== deleting._id) : []
  const deletingCount = deleting?.productCount ?? 0
  const needsMove = deletingCount > 0

  return (
    <SettingsCard
      title="Categories"
      description="Changes here apply immediately. The photo is the one shown in the home page categories. Spec type sets the specification fields in the product form."
    >
      <form
        className="grid gap-4 rounded-xl border border-[var(--border)] p-3 sm:grid-cols-[13rem_1fr] sm:p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length >= 2 && !newUploading) create.mutate()
        }}
      >
        <CategoryPhotoPicker
          className="w-full max-w-[15rem] sm:max-w-none"
          photo={newPhoto || undefined}
          custom={Boolean(newPhoto)}
          hasBuiltIn={false}
          uploading={newUploading}
          onPick={pickNewPhoto}
          onReset={() => setNewPhoto('')}
        />
        <div className="flex min-w-0 flex-col gap-3">
          <Input label="New category" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Laptops" maxLength={60} />
          <Input label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          <p className="text-[11px] text-[var(--fg-muted)]">
            Photo: a wide picture (about 16:10) looks best; the corners are rounded for you, like on the home page.
          </p>
          <Button type="submit" className="self-start" loading={create.isPending} disabled={name.trim().length < 2 || newUploading}>
            <SiteIcon name="plus" size={14} /> Add category
          </Button>
        </div>
      </form>

      {categories.isLoading ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : categories.isError ? (
        <QueryErrorState onRetry={() => categories.refetch()} />
      ) : list.length ? (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]">
          {list.map((c) => {
            const count = c.productCount ?? 0
            return (
              <li
                key={c._id}
                className={cn(
                  'flex min-w-0 flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3',
                  pending(c._id) && 'opacity-60'
                )}
              >
                {/* Phones: photo + name on one line, the controls below */}
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CategoryPhotoPicker
                    className="w-24 shrink-0 sm:w-28"
                    photo={categoryPhoto(c)}
                    custom={Boolean(c.image)}
                    hasBuiltIn={Boolean(BUILT_IN_CATEGORY_PHOTOS[c.slug])}
                    uploading={uploadingId === c._id}
                    onPick={(file) => changePhoto(c, file)}
                    onReset={() => update.mutate({ id: c._id, patch: { image: '' } })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.name}
                      {!c.isActive ? <span className="ms-2 text-xs font-normal text-[var(--fg-muted)]">hidden</span> : null}
                    </p>
                    <p className="truncate text-[11px] text-[var(--fg-muted)]">
                      /{c.slug} · {count} product{count === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Spec type for ${c.name}`}
                    value={isTemplateId(c.specTemplate) ? c.specTemplate : ''}
                    disabled={pending(c._id)}
                    onChange={(e) =>
                      update.mutate({
                        id: c._id,
                        patch: { specTemplate: e.target.value },
                      })
                    }
                    className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-input)] px-2 text-xs sm:max-w-[11rem] sm:flex-none"
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
                    onClick={() =>
                      update.mutate({
                        id: c._id,
                        patch: { isActive: !c.isActive },
                      })
                    }
                  >
                    {c.isActive ? 'Hide' : 'Show'}
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleting(c)
                      setMoveTo('')
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)]"
                    aria-label={`Delete ${c.name}`}
                  >
                    <SiteIcon name="trash" size={14} />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">No categories yet — add your first above.</p>
      )}
      <p className="text-[11px] text-[var(--fg-muted)]">Hidden categories and their products are not shown in the shop.</p>

      <Modal open={Boolean(deleting)} onClose={() => setDeleting(null)} title={`Delete “${deleting?.name ?? ''}”?`} size="sm">
        {needsMove ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
              It still has {deletingCount} product
              {deletingCount === 1 ? '' : 's'}. Choose where to move {deletingCount === 1 ? 'it' : 'them'}, then the category is deleted.
            </p>
            {others.length ? (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Move products to</span>
                <select
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                  className="h-11 rounded-xl border border-[var(--border)] bg-[var(--bg-input)] px-3.5"
                >
                  <option value="" disabled>
                    Choose a category
                  </option>
                  {others.map((o) => (
                    <option key={o._id} value={o._id}>
                      {o.name}
                      {!o.isActive ? ' (hidden)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-[var(--danger)]">Add another category first, so the products have somewhere to go.</p>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">It has no products. This cannot be undone.</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={remove.isPending}
            disabled={needsMove && !moveTo}
            onClick={() =>
              deleting &&
              remove.mutate({
                id: deleting._id,
                moveTo: needsMove ? moveTo : undefined,
              })
            }
          >
            {needsMove ? 'Move and delete' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </SettingsCard>
  )
}
