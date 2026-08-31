import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/api/settingsApi'
import { categoriesApi } from '@/api/categoriesApi'
import { adminApi } from '@/api/adminApi'
import { getErrorMessage } from '@/api/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { QueryErrorState } from '@/components/ui/QueryErrorState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/Badge'
import { useToastStore } from '@/store/toastStore'

export function Settings() {
  const qc = useQueryClient()
  const toast = useToastStore((s) => s.push)

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await settingsApi.get()).data.data,
  })

  const categories = useQuery({
    queryKey: ['categories', 'all'],
    queryFn: async () => (await categoriesApi.list(true)).data.data,
  })

  const [form, setForm] = useState({
    storeName: 'Brynoxa',
    currency: 'MAD',
    shippingFlatRate: 0,
    freeShippingMin: 0,
    taxRate: 0,
    supportEmail: 'support@brynoxa.com',
    codEnabled: true,
  })

  const [catName, setCatName] = useState('')
  const [catDescription, setCatDescription] = useState('')
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null)

  useEffect(() => {
    if (settings.data) {
      setForm({
        storeName: settings.data.storeName,
        currency: settings.data.currency,
        shippingFlatRate: settings.data.shippingFlatRate,
        freeShippingMin: settings.data.freeShippingMin,
        taxRate: settings.data.taxRate,
        supportEmail: settings.data.supportEmail,
        codEnabled: settings.data.codEnabled,
      })
    }
  }, [settings.data])

  const save = useMutation({
    mutationFn: () => adminApi.settings.update(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      toast('Settings saved', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const createCategory = useMutation({
    mutationFn: () =>
      adminApi.categories.create({ name: catName, description: catDescription || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      setCatName('')
      setCatDescription('')
      toast('Category created', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const toggleCategory = useMutation({
    mutationFn: (c: { _id: string; isActive: boolean }) =>
      adminApi.categories.update(c._id, { isActive: !c.isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast('Category updated', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  const removeCategory = useMutation({
    mutationFn: (id: string) => adminApi.categories.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] })
      toast('Category deleted', 'success')
    },
    onError: (e) => toast(getErrorMessage(e), 'error'),
  })

  if (settings.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    )
  }

  if (settings.isError) {
    return <QueryErrorState onRetry={() => settings.refetch()} />
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-[var(--fg-muted)]">Store configuration and catalog setup</p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Store</h2>
        <form
          className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
        >
          <Input
            label="Store name"
            value={form.storeName}
            onChange={(e) => setForm({ ...form, storeName: e.target.value })}
          />
          <Input
            label="Currency"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value })}
            disabled
          />
          <Input
            label="Flat shipping rate (DH)"
            type="number"
            min={0}
            value={form.shippingFlatRate}
            onChange={(e) => setForm({ ...form, shippingFlatRate: Number(e.target.value) })}
          />
          <Input
            label="Free shipping minimum (DH)"
            type="number"
            min={0}
            value={form.freeShippingMin}
            onChange={(e) => setForm({ ...form, freeShippingMin: Number(e.target.value) })}
          />
          <Input
            label="Tax rate (%)"
            type="number"
            min={0}
            value={form.taxRate}
            onChange={(e) => setForm({ ...form, taxRate: Number(e.target.value) })}
          />
          <Input
            label="Support email"
            type="email"
            value={form.supportEmail}
            onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.codEnabled}
              onChange={(e) => setForm({ ...form, codEnabled: e.target.checked })}
            />
            Cash on delivery enabled
          </label>
          <Button type="submit" loading={save.isPending}>
            Save settings
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Categories</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            Add categories for your products. They appear in the shop and product form.
          </p>
        </div>

        <form
          className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            createCategory.mutate()
          }}
        >
          <Input
            label="Category name"
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            placeholder="e.g. Laptops"
            required
          />
          <Input
            label="Description (optional)"
            value={catDescription}
            onChange={(e) => setCatDescription(e.target.value)}
          />
          <Button type="submit" loading={createCategory.isPending}>
            Add category
          </Button>
        </form>

        {categories.isLoading ? (
          <Spinner />
        ) : categories.isError ? (
          <QueryErrorState onRetry={() => categories.refetch()} />
        ) : (
          <ul className="space-y-2">
            {categories.data?.map((c) => (
              <li
                key={c._id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-[var(--fg-muted)]">/{c.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={c.isActive ? 'success' : 'danger'}>
                    {c.isActive ? 'On' : 'Off'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => toggleCategory.mutate(c)}>
                    {c.isActive ? 'Hide' : 'Show'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteCategoryId(c._id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
            {!categories.data?.length ? (
              <p className="text-sm text-[var(--fg-muted)]">No categories yet — add your first above.</p>
            ) : null}
          </ul>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(deleteCategoryId)}
        title="Delete category?"
        description="Products in this category may no longer appear correctly. This cannot be undone."
        confirmLabel="Delete"
        loading={removeCategory.isPending}
        onClose={() => setDeleteCategoryId(null)}
        onConfirm={() => {
          if (deleteCategoryId) {
            removeCategory.mutate(deleteCategoryId, {
              onSuccess: () => setDeleteCategoryId(null),
            })
          }
        }}
      />
    </div>
  )
}
