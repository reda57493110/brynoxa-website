import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/adminApi'
import { brandsApi } from '@/api/brandsApi'
import { uploadApi } from '@/api/uploadApi'
import { getErrorMessage } from '@/api/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SiteIcon } from '@/components/ui/SiteIcon'
import { prepareImageForUpload } from '@/lib/prepareImage'
import { toast } from '@/store/toastStore'
import { cn } from '@/lib/cn'
import type { Brand } from '@/types'
import { SettingsCard } from './SettingsUi'
import { useReportDirty } from './dirty'

/** "hp", "H.P." and "Hp " are the same brand */
const sameName = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9]/g, '') === b.toLowerCase().replace(/[^a-z0-9]/g, '')

/** One brand: logo, name (rename in place), shown / hidden, products using it, delete when unused */
function BrandRow({ brand, others, onDelete }: { brand: Brand; others: Brand[]; onDelete: () => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState(brand.name.trim())
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const clash = others.find((o) => o._id !== brand._id && sameName(o.name, name))
  const nameError = name.trim().length < 2 ? '2 characters or more' : clash ? `Same as “${clash.name}”` : undefined
  const renamed = name.trim() !== brand.name.trim()
  useReportDirty(`brand-${brand._id}`, renamed)

  const update = useMutation({
    mutationFn: (patch: Partial<Pick<Brand, 'name' | 'logo' | 'isActive'>>) => adminApi.brands.update(brand._id, patch),
    onSuccess: (_r, patch) => {
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['brands'] })
      toast.success(patch.name ? 'Brand renamed' : patch.logo !== undefined ? 'Logo saved' : patch.isActive ? 'Brand shown in the shop' : 'Brand hidden from the shop filter')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const pickLogo = async (file: File) => {
    setUploading(true)
    try {
      const { blob, filename } = await prepareImageForUpload(file)
      const url = (await uploadApi.image(blob, filename)).data.data.url
      update.mutate({ logo: url })
    } catch (e) {
      toast.error(getErrorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const count = brand.productCount ?? 0
  return (
    <li className={cn('flex flex-wrap items-start gap-3 py-2.5 first:pt-0 last:pb-0 sm:flex-nowrap', !brand.isActive && 'opacity-70')}>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        aria-label={brand.logo ? `Change the ${brand.name} logo` : `Add a ${brand.name} logo`}
        title={brand.logo ? 'Change logo' : 'Add logo'}
        className="relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--border)] bg-white"
      >
        {uploading ? <Spinner size="sm" /> : brand.logo ? <img src={brand.logo} alt="" className="h-full w-full object-contain p-1" /> : <SiteIcon name="plus" size={14} className="text-neutral-500" />}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void pickLogo(file)
        }}
      />
      <form
        className="flex min-w-0 flex-1 basis-48 items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (renamed && !nameError) update.mutate({ name: name.trim() })
        }}
      >
        <div className="min-w-0 flex-1">
          <Input aria-label={`Name of ${brand.name}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} error={renamed ? nameError : undefined} />
          <p className="mt-1 text-[11px] text-[var(--fg-muted)]">
            {count ? `${count} product${count === 1 ? '' : 's'}` : 'No product yet'}
            {/* Two spellings of one brand: the one with fewer products is the one to remove */}
            {!renamed && clash && ((clash.productCount ?? 0) > count || ((clash.productCount ?? 0) === count && clash._id < brand._id)) ? (
              <span className="text-[var(--warning)]">
                {' · '}same as “{clash.name.trim()}”{count ? ': set its products to that brand, then delete this one' : ': you can delete this one'}
              </span>
            ) : null}
            {brand.logo ? (
              <>
                {' · '}
                <button type="button" className="underline-offset-2 hover:text-[var(--danger)] hover:underline" onClick={() => update.mutate({ logo: '' })}>
                  remove logo
                </button>
              </>
            ) : null}
          </p>
        </div>
        {renamed ? (
          <Button type="submit" size="sm" className="mt-1" loading={update.isPending} disabled={Boolean(nameError)}>
            Save
          </Button>
        ) : null}
      </form>
      <div className="ms-auto flex shrink-0 items-center gap-1 sm:mt-1">
        <Button size="sm" variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ isActive: !brand.isActive })}>
          {brand.isActive ? 'Hide' : 'Show'}
        </Button>
        <button
          type="button"
          onClick={onDelete}
          disabled={count > 0}
          title={count > 0 ? 'Used by products: change their brand first' : 'Delete'}
          aria-label={`Delete ${brand.name}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-[var(--fg-muted)]"
        >
          <SiteIcon name="trash" size={14} />
        </button>
      </div>
    </li>
  )
}

/**
 * Admin → Settings → Catalog → Brands: every brand with how many products use it. Rename, logo,
 * hide from the shop's Brand filter, delete when no product uses it. Saved right away.
 */
export function BrandsSettings() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<Brand | null>(null)
  useReportDirty('brand-new', Boolean(name.trim()))

  const brands = useQuery({
    queryKey: ['admin-brands'],
    queryFn: async () => (await brandsApi.list(true)).data.data as Brand[],
  })
  const list = brands.data ?? []
  const clash = list.find((b) => sameName(b.name, name))

  const create = useMutation({
    mutationFn: () => adminApi.brands.create({ name: name.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['brands'] })
      setName('')
      toast.success('Brand added')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => adminApi.brands.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-brands'] })
      qc.invalidateQueries({ queryKey: ['brands'] })
      setDeleting(null)
      toast.success('Brand deleted')
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  })

  const unused = list.filter((b) => !b.productCount).length

  return (
    <SettingsCard
      title="Brands"
      description="The brands of your products, used by the shop's Brand filter. Changes apply immediately."
    >
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length >= 2 && !clash) create.mutate()
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            label="New brand"
            placeholder="e.g. Lenovo"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            error={name.trim() && clash ? `Already there: “${clash.name}”` : undefined}
          />
        </div>
        <Button type="submit" className="mt-7" loading={create.isPending} disabled={name.trim().length < 2 || Boolean(clash)}>
          <SiteIcon name="plus" size={14} /> Add
        </Button>
      </form>

      <div className="mt-4">
        {brands.isLoading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : brands.isError ? (
          <QueryErrorState onRetry={() => brands.refetch()} />
        ) : list.length ? (
          <>
            <p className="mb-2 text-[11px] text-[var(--fg-muted)]">
              {list.length} brand{list.length === 1 ? '' : 's'}
              {unused ? ` · ${unused} not used by any product (can be deleted)` : ''} · Hidden brands stay on their products but leave the shop filter.
            </p>
            <ul className="divide-y divide-[var(--border)]">
              {list.map((b) => (
                <BrandRow key={`${b._id}-${b.name}`} brand={b} others={list} onDelete={() => setDeleting(b)} />
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-[var(--fg-muted)]">No brand yet. Brands are also added from the product form.</p>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete “${deleting?.name ?? ''}”?`}
        description="No product uses it. This cannot be undone."
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting._id)}
      />
    </SettingsCard>
  )
}
